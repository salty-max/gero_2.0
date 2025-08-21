import type { RegName } from '@gero/vm'
import type { Cmd, Ev } from './protocol'
import { fmt16 } from '@gero/util'

type Listener<T extends Ev['t']> = (ev: Extract<Ev, { t: T }>) => void

const isEvType = <K extends Ev['t']>(
  ev: Ev,
  t: K
): ev is Extract<Ev, { t: K }> => ev.t === t

export class VMClient {
  private w: Worker
  // Per-event subscribers. We store wrapper callbacks that accept `Ev`,
  // and re-narrow before calling the user's typed listener.
  private listeners = new Map<Ev['t'], Set<(ev: Ev) => void>>()
  // Monotonic id used to correlate `peek` requests to `mem` responses.
  private reqId = 1
  // For in-flight `peek` calls: reqId -> resolver callback
  private memWaiters = new Map<
    number,
    (data: Uint8Array, ev: Extract<Ev, { t: 'mem' }>) => void
  >()

  constructor() {
    // Spin up the dedicated module worker that owns the VM.
    this.w = new Worker(new URL('./vm.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.w.onmessage = (e: MessageEvent<Ev>) => {
      const ev = e.data
      // If this is a memory read response with a reqId, resolve
      // a pending `peek()` promise (and remove the waiter).
      if (ev.t === 'mem' && typeof ev.reqId === 'number') {
        const cb = this.memWaiters.get(ev.reqId)
        if (cb) {
          this.memWaiters.delete(ev.reqId)
          cb(ev.data, ev)
        }
      }

      // Fan-out the event to any subscribers for this event type.
      const subs = this.listeners.get(ev.t)
      if (subs) subs.forEach((fn) => fn(ev))
    }
  }

  dispose() {
    this.w.terminate()
  }

  on<T extends Ev['t']>(type: T, fn: Listener<T>) {
    // Wrap the typed listener in a small guard that only forwards
    // events with the matching discriminant.
    const set = this.listeners.get(type) ?? new Set<(ev: Ev) => void>()
    const handler = (ev: Ev) => {
      if (isEvType(ev, type)) fn(ev)
    }
    set.add(handler)
    this.listeners.set(type, set)
    return () => set.delete(handler)
  }

  send(cmd: Cmd) {
    // Fire-and-forget command to the worker.
    this.w.postMessage(cmd)
  }

  init(memorySize: number, ivAddr?: number) {
    this.send({ t: 'init', memorySize, ivAddr })
  }

  load(bytes: Uint8Array, start: number) {
    this.send({ t: 'load', bytes, start })
  }

  run() {
    this.send({ t: 'run' })
  }

  pause() {
    this.send({ t: 'pause' })
  }

  step(count = 1) {
    this.send({ t: 'step', count })
  }

  reset() {
    this.send({ t: 'reset' })
  }

  setBreakpoints(addrs: number[]) {
    this.send({ t: 'breakpoints', addrs })
  }

  peek(addr: number, len: number, timeoutMs = 500): Promise<Uint8Array> {
    // Request a memory range from the worker and resolve when the
    // corresponding `mem` event arrives, or reject on timeout.
    const reqId = this.reqId++
    this.send({ t: 'peek', addr, len, reqId })

    return new Promise((resolve, reject) => {
      // Defensive timeout so UI can't hang forever on a lost message.
      const t = setTimeout(() => {
        this.memWaiters.delete(reqId)
        reject(new Error(`peek timeout (addr=${fmt16(addr)}, len=${len})`))
      }, timeoutMs)

      // Register resolver that clears timeout and returns a copy.
      this.memWaiters.set(reqId, (data) => {
        clearTimeout(t)
        resolve(new Uint8Array(data))
      })
    })
  }

  poke(addr: number, data: Uint8Array) {
    this.send({ t: 'poke', addr, data })
  }

  setReg(reg: RegName, value: number) {
    this.send({ t: 'setReg', reg, value })
  }
}
