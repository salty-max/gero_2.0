import { CPU, createMemory, MemoryMapper, type RegName } from '@gero/vm'
import type { Ev, Fault, Snapshot } from './protocol'
import { u16 } from '@gero/util'
import { normalizeMeta, toError, withAddrMeta } from './errors'

export class VMService {
  private cpu: CPU | null = null
  private mm: MemoryMapper | null = null
  private ivBase = 0x1000
  private running = false
  private lastTick = 0
  private runToken = 0
  private breakpoints = new Set<number>()
  private onEvent: ((ev: Ev) => void) | null = null

  setOnEvent(cb: (ev: Ev) => void) {
    this.onEvent = cb
  }

  private post(ev: Ev) {
    if (this.onEvent) this.onEvent(ev)
  }

  private postFault(ip: number, err: unknown) {
    const fault = toError(err)
    const baseMeta: Record<string, unknown> = normalizeMeta(fault.meta) ?? {}
    const maybeAddr = baseMeta['addr']
    const addr = typeof maybeAddr === 'number' ? maybeAddr : ip

    this.post({
      t: 'paused',
      reason: 'fault',
      ip,
      fault: { ...fault, meta: { ...baseMeta, addr } },
    })
  }

  private snap(): Snapshot {
    if (!this.cpu) throw new Error('CPU not ready')
    const regs = this.cpu.getRegisters()
    const ip = this.cpu.getRegister('ip')
    const sp = this.cpu.getRegister('sp')
    const fp = this.cpu.getRegister('fp')
    return { regs, ip, sp, fp }
  }

  private postSnapshot() {
    this.post({ t: 'snapshot', snap: this.snap() })
  }

  async loop() {
    if (!this.cpu) return
    const my = ++this.runToken
    this.running = true

    while (this.running && my === this.runToken) {
      const ipBefore = this.cpu.getRegister('ip')
      if (this.breakpoints.has(ipBefore)) {
        this.running = false
        this.post({ t: 'paused', reason: 'breakpoint', ip: ipBefore })
        this.postSnapshot()
        return
      }

      try {
        const res = this.cpu.tryStep()
        if (!res.ok) {
          this.running = false
          this.postFault(res.ip, res.error)
          this.postSnapshot()
          return
        }
        if (res.halted) {
          this.running = false
          this.post({ t: 'paused', reason: 'halt', ip: ipBefore })
          this.postSnapshot()
          return
        }
      } catch (e) {
        this.running = false
        this.postFault(ipBefore, toError(e))
        this.postSnapshot()
        return
      }

      const ipAfter = this.cpu.getRegister('ip')
      const now = performance.now()
      if ((ipAfter & 0x1f) === 0 && now - this.lastTick > 16) {
        this.lastTick = now
        this.post({ t: 'tick', ip: ipAfter })
      }
      if ((ipAfter & 0x3ff) === 0) await Promise.resolve()
    }
  }

  ping() {
    this.post({ t: 'pong' })
  }

  init(memorySize: number, ivAddr?: number) {
    const size = memorySize >>> 0
    this.ivBase = ivAddr ?? 0x1000
    this.mm = new MemoryMapper()
    const ram = createMemory(size)
    this.mm.map(ram, 0, size - 1, true)
    this.cpu = new CPU(this.mm, this.ivBase)
    this.post({ t: 'ready' })
  }

  load(bytes: Uint8Array, start: number) {
    if (!this.cpu) return
    let fault: Fault | null = null
    for (let i = 0; i < bytes.length; i++) {
      const addr = u16(start + i)
      const res = this.cpu.tryWriteByte(addr, bytes[i]!)
      if (!res.ok) {
        fault = withAddrMeta(toError(res.error), addr)
        break
      }
    }
    if (!fault) this.cpu.setRegister('ip', u16(start))
    this.postSnapshot()
    if (fault) this.postFault(this.cpu.getRegister('ip'), fault)
  }

  run() {
    if (!this.cpu || this.running) return
    this.loop()
  }

  pause() {
    if (!this.cpu) return
    this.running = false
    this.runToken++
    this.post({ t: 'paused', reason: 'manual', ip: this.cpu.getRegister('ip') })
    this.postSnapshot()
  }

  step(count = 1) {
    if (!this.cpu) return
    const n = count ?? 1
    let halted = false
    let fault: Fault | null = null
    let lastIp = this.cpu.getRegister('ip')
    for (let i = 0; i < n; i++) {
      const ipBefore = this.cpu.getRegister('ip')
      lastIp = ipBefore
      if (this.breakpoints.has(ipBefore)) {
        this.post({ t: 'paused', reason: 'breakpoint', ip: lastIp })
        break
      }
      const res = this.cpu.tryStep()
      if (!res.ok) {
        fault = toError(res.error)
        break
      }
      if (res.halted) {
        halted = true
        break
      }
    }
    this.postSnapshot()
    if (fault) this.postFault(this.cpu.getRegister('ip'), fault)
    else if (halted) this.post({ t: 'paused', reason: 'halt', ip: lastIp })
  }

  reset() {
    if (!this.mm) return
    this.running = false
    this.runToken++
    this.cpu = new CPU(this.mm, this.ivBase)
    this.lastTick = 0
    this.postSnapshot()
  }

  setBreakpoints(addrs: number[]) {
    this.breakpoints = new Set(addrs.map((a) => u16(a)))
  }

  peek(addr: number, len: number, reqId?: number): Uint8Array {
    if (!this.cpu) return new Uint8Array(0)
    const a0 = u16(addr)
    const n = len >>> 0
    const buf = new Uint8Array(n)
    let fault: Fault | null = null
    for (let i = 0; i < n; i++) {
      const a = u16(a0 + i)
      const res = this.cpu.tryReadByte(a)
      if (!res.ok) {
        fault = withAddrMeta(toError(res.error), a)
        break
      }
      buf[i] = res.value
    }
    this.post({ t: 'mem', addr: a0, data: buf, reqId })
    if (fault) this.postFault(this.cpu.getRegister('ip'), fault)
    return buf
  }

  poke(addr: number, data: Uint8Array) {
    if (!this.cpu) return
    const a0 = u16(addr)
    for (let i = 0; i < data.length; i++) {
      const a = u16(a0 + i)
      const res = this.cpu.tryWriteByte(a, data[i]!)
      if (!res.ok) {
        this.postFault(
          this.cpu.getRegister('ip'),
          withAddrMeta(toError(res.error), a)
        )
        break
      }
    }
  }

  setReg(reg: RegName, value: number) {
    if (!this.cpu) return
    const res = this.cpu.trySetRegister(reg, u16(value))
    this.postSnapshot()
    if (!res.ok) this.postFault(this.cpu.getRegister('ip'), res.error)
  }
}
