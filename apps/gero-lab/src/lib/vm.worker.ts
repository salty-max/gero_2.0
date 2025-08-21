/// <reference lib="webworker" />
// This file runs inside a Dedicated Web Worker. It owns the VM (CPU + Memory)
// and communicates with the UI thread via postMessage/onmessage using the
// discriminated union types defined in protocol.ts.
//
// High-level flow:
// - UI posts Cmd messages (init/load/run/pause/step/reset/...)
// - Worker mutates CPU/Memory and posts Ev events back (ready/paused/tick/...)
// - A small run loop executes instructions and yields periodically so the UI
//   stays responsive. Faults/halts/breakpoints pause execution and report state.

import { CPU, createMemory, MemoryMapper } from '@gero/vm'
import type { Cmd, Ev, Fault, Snapshot } from './protocol'
import { u16 } from '@gero/util'
import { normalizeMeta, toError, withAddrMeta } from './errors'

let cpu: CPU | null = null
let mm: MemoryMapper | null = null
let ivBase = 0x1000
let running = false
let lastTick = 0 // time of last UI heartbeat
let runToken = 0 // incremented to invalidate in-flight loops
let breakpoints = new Set<number>()

function post(ev: Ev, transfer?: Transferable[]) {
  self.postMessage(ev, transfer ?? [])
}

export function postFault(ip: number, err: unknown) {
  const fault = toError(err)

  // Ensure meta is a clean record and always carry an addr
  const baseMeta: Record<string, unknown> = normalizeMeta(fault.meta) ?? {}
  const maybeAddr = baseMeta['addr']
  const addr = typeof maybeAddr === 'number' ? maybeAddr : ip

  post({
    t: 'paused',
    reason: 'fault',
    ip,
    fault: { ...fault, meta: { ...baseMeta, addr } },
  })
}

function snap(): Snapshot {
  if (!cpu) throw new Error('CPU not ready')

  const regs = cpu.getRegisters()
  const ip = cpu.getRegister('ip')
  const sp = cpu.getRegister('sp')
  const fp = cpu.getRegister('fp')

  return { regs, ip, sp, fp }
}

function postSnapshot() {
  post({ t: 'snapshot', snap: snap() })
}

async function loop() {
  if (!cpu) return
  const my = ++runToken // capture a token so we can cancel this loop later
  running = true

  while (running && my === runToken) {
    const ipBefore = cpu.getRegister('ip')

    // Breakpoint before executing the instruction at IP
    if (breakpoints.has(ipBefore)) {
      running = false
      post({ t: 'paused', reason: 'breakpoint', ip: ipBefore })
      postSnapshot()
      return
    }

    try {
      const res = cpu.tryStep()
      if (!res.ok) {
        running = false
        postFault(res.ip, res.error)
        postSnapshot()
        return
      }
      if (res.halted) {
        running = false
        post({ t: 'paused', reason: 'halt', ip: ipBefore })
        postSnapshot()
        return
      }
    } catch (e) {
      running = false
      postFault(ipBefore, toError(e))
      postSnapshot()
      return
    }

    const ipAfter = cpu.getRegister('ip')
    // Optional: stream trace
    // post({ t: 'trace', ip: ipBefore, before, after })
    //
    // Lightweight heartbeat so UI can update arrows / progress bars.
    const now = performance.now()
    if ((ipAfter & 0x1f) === 0 && now - lastTick > 16) {
      lastTick = now
      post({ t: 'tick', ip: ipAfter })
    }

    // Yield to UI ~every 1k instructions for responsiveness.
    if ((ipAfter & 0x3ff) === 0) await Promise.resolve()
  }
}

self.onmessage = (e: MessageEvent<Cmd>) => {
  const m = e.data

  switch (m.t) {
    case 'init': {
      // Create CPU + flat RAM mapping using provided size and IV base.
      const size = m.memorySize >>> 0
      ivBase = m.ivAddr ?? 0x1000

      // Map a flat RAM device across [0 .. size - 1].
      mm = new MemoryMapper()
      const ram = createMemory(size)
      mm.map(ram, 0, size - 1, true)

      cpu = new CPU(mm, ivBase)
      post({ t: 'ready' })
      break
    }

    case 'load': {
      if (!cpu) return

      const { bytes, start } = m
      let fault: Fault | null = null
      // Sequentially write bytes to memory. Stop on first fault.
      for (let i = 0; i < bytes.length; i++) {
        const addr = u16(start + i)
        const res = cpu.tryWriteByte(addr, bytes[i]!)
        if (!res.ok) {
          fault = withAddrMeta(toError(res.error), addr)
          break
        }
      }

      // If load succeeded, set IP to start (normalized to 16-bit).
      if (!fault) cpu.setRegister('ip', u16(start))
      postSnapshot()
      if (fault) postFault(cpu.getRegister('ip'), fault)
      break
    }

    case 'run': {
      if (!cpu || running) return
      // Start the execution loop (async); returns immediately.
      loop()
      break
    }

    case 'pause': {
      if (!cpu) return
      running = false
      runToken++ // 🔑 cancel any in-flight loop immediately
      post({ t: 'paused', reason: 'manual', ip: cpu.getRegister('ip') })
      postSnapshot()
      break
    }

    case 'step': {
      if (!cpu) return

      const n = m.count ?? 1
      let halted = false
      let fault: Fault | null = null
      let lastIp = cpu.getRegister('ip')

      // Execute up to N instructions, honoring breakpoints and capturing
      // the first error/halt encountered.
      for (let i = 0; i < n; i++) {
        // Breakpoint before executing at current IP
        const ipBefore = cpu.getRegister('ip')
        lastIp = ipBefore
        if (breakpoints.has(ipBefore)) {
          post({ t: 'paused', reason: 'breakpoint', ip: lastIp })
          break
        }
        const res = cpu.tryStep()
        if (!res.ok) {
          fault = toError(res.error)
          break
        }
        if (res.halted) {
          halted = true
          break
        }
      }

      postSnapshot()

      if (fault) {
        postFault(cpu.getRegister('ip'), fault)
      } else if (halted) {
        post({ t: 'paused', reason: 'halt', ip: lastIp })
      }
      break
    }

    case 'reset': {
      if (!mm) return

      running = false
      runToken++ // 🔑 cancel loops created before reset

      // Reinstantiate CPU; RAM mapping stays intact
      cpu = new CPU(mm, ivBase)
      lastTick = 0
      postSnapshot()
      break
    }

    case 'breakpoints': {
      // Normalize addresses to 16-bit and replace the set.
      breakpoints = new Set(m.addrs.map((a) => u16(a)))
      break
    }

    case 'peek': {
      if (!cpu) return

      const addr = u16(m.addr)
      const len = m.len >>> 0
      const buf = new Uint8Array(len)
      let fault: Fault | null = null

      // Read a block of memory; return what we have even if a fault occurs.
      for (let i = 0; i < len; i++) {
        const a = u16(addr + i)
        const res = cpu.tryReadByte(u16(addr + i))
        if (!res.ok) {
          fault = withAddrMeta(toError(res.error), a)
          break
        }
        buf[i] = res.value
      }
      // Always return whatever we have so far
      post({ t: 'mem', addr, data: buf, reqId: m.reqId }, [buf.buffer])
      if (fault) postFault(cpu.getRegister('ip'), fault)
      break
    }

    case 'poke': {
      if (!cpu) return

      const addr = u16(m.addr)
      const data = m.data
      // Write a block of memory; stop on first error.
      for (let i = 0; i < data.length; i++) {
        const a = u16(addr + i)
        const res = cpu.tryWriteByte(a, data[i]!)
        if (!res.ok) {
          postFault(cpu.getRegister('ip'), withAddrMeta(toError(res.error), a))
          break
        }
      }
      break
    }

    case 'setReg': {
      if (!cpu) return

      // Normalize external input and set register; snapshot afterward.
      const res = cpu.trySetRegister(m.reg, u16(m.value))
      postSnapshot()
      if (!res.ok) postFault(cpu.getRegister('ip'), res.error)
      break
    }
  }
}
