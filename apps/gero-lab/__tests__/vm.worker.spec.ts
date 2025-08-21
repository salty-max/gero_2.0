import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadWorker } from './worker.utils'

describe('vm.worker (integration, real VM)', () => {
  beforeEach(async () => {
    vi.resetModules()
    self.onmessage = null
    self.postMessage = () => {}
  })

  it('init -> ready', async () => {
    const w = await loadWorker()
    w.send({ t: 'init', memorySize: 0x100 })

    expect(w.find('ready')).toBeTruthy()
  })

  it('load success sets IP and posts snapshot', async () => {
    const w = await loadWorker()
    w.send({ t: 'init', memorySize: 0x100 })
    w.takeAll()

    w.send({ t: 'load', bytes: new Uint8Array([1, 2, 3]), start: 0x0042 })

    const snap = w.find('snapshot')!
    expect(snap.snap.ip).toBe(0x0042)
  })

  it('load beyond RAM => paused:fault with meta.addr', async () => {
    const w = await loadWorker()
    w.send({ t: 'init', memorySize: 8 })
    w.takeAll()

    w.send({ t: 'load', bytes: new Uint8Array(16), start: 0x0000 })

    const paused = w.find('paused')!
    expect(paused.reason).toBe('fault')
    // first failing address after writing 0..7
    expect(paused.fault?.meta?.addr).toBe(8)
  })

  it('breakpoint pauses before executing at IP (run path)', async () => {
    const w = await loadWorker()
    w.send({ t: 'init', memorySize: 0x100 })
    w.send({ t: 'load', bytes: new Uint8Array([1, 1, 1]), start: 0x0000 })
    w.takeAll()

    w.send({ t: 'breakpoints', addrs: [0x0000] })
    w.send({ t: 'run' })

    const paused = w.find('paused')!
    expect(paused.reason).toBe('breakpoint')
    expect(paused.ip).toBe(0x0000)

    const snap = w.find('snapshot')!
    expect(snap.snap.ip).toBe(0x0000)
  })

  it('breakpoint pauses before executing at IP (step path)', async () => {
    const w = await loadWorker()
    w.send({ t: 'init', memorySize: 0x200 })
    w.send({ t: 'load', bytes: new Uint8Array([1, 1, 1]), start: 0x0100 })
    w.takeAll()

    w.send({ t: 'breakpoints', addrs: [0x0100] })
    w.send({ t: 'step', count: 5 })

    const paused = w.find('paused')!
    expect(paused.reason).toBe('breakpoint')
    expect(paused.ip).toBe(0x0100)

    const snap = w.find('snapshot')!
    expect(snap.snap.ip).toBe(0x0100)
  })

  it('peek returns mem buffer (even partial) and faults on OOB', async () => {
    const w = await loadWorker()
    w.send({ t: 'init', memorySize: 8 })
    w.send({ t: 'load', bytes: new Uint8Array([9, 8, 7, 6]), start: 0x0000 })
    w.takeAll()

    w.send({ t: 'peek', addr: 6, len: 4, reqId: 7 }) // 6,7 ok; 8,9 OOB
    const mem = w.find('mem')!
    expect(mem.reqId).toBe(7)
    expect(mem.data.byteLength).toBe(4)

    const paused = w.find('paused')!
    expect(paused.reason).toBe('fault')
    expect(paused.fault?.meta?.addr).toBe(8)

    const memIdx = w.all.findIndex((e) => e.t === 'mem')
    const pausedIdx = w.all.findIndex((e) => e.t === 'paused')
    expect(pausedIdx).toBeGreaterThan(memIdx)
  })

  it('poke faults with precise failing addr', async () => {
    const w = await loadWorker()
    w.send({ t: 'init', memorySize: 8 })
    w.takeAll()

    w.send({ t: 'poke', addr: 6, data: new Uint8Array([1, 2, 3]) }) // 6..8 (8 OOB)
    const paused = w.find('paused')!
    expect(paused.reason).toBe('fault')
    expect(paused.fault?.meta?.addr).toBe(8)

    // no mem event for poke
    expect(w.all.some((e) => e.t === 'mem')).toBe(false)
  })

  it('pause and reset cancel run loop', async () => {
    const w = await loadWorker()
    w.send({ t: 'init', memorySize: 0x100 })
    w.send({ t: 'load', bytes: new Uint8Array([1, 1, 1]), start: 0x0000 })
    w.takeAll()

    w.send({ t: 'run' })
    w.takeAll()

    w.send({ t: 'pause' })
    const paused = w.find('paused')!
    expect(paused.reason).toBe('manual')
    w.takeAll()

    w.send({ t: 'reset' })
    const snap = w.find('snapshot')!
    expect(snap.snap).toBeTruthy()

    // ensure no stray events from the old loop
    const stray = w.all.find(
      (e) => e.t === 'tick' || (e.t === 'paused' && e.reason !== 'manual')
    )
    expect(stray).toBeUndefined()
  })
})
