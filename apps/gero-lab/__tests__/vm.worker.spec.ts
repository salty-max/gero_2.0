import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VMService } from '../src/lib/vm.service'
import type { Ev } from '../src/lib/protocol'
import { MessageChannel } from 'node:worker_threads'
import { expose, wrap, proxy } from 'comlink'
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs'

async function harness() {
  const svc = new VMService()
  const msgs: Ev[] = []
  const { port1, port2 } = new MessageChannel()
  const ep1 = nodeEndpoint(port1)
  const ep2 = nodeEndpoint(port2)
  expose(svc, ep1)
  const remote = wrap<VMService>(ep2)

  await remote.setOnEvent(proxy((e: Ev) => msgs.push(e)))

  const takeAll = () => {
    const out = msgs.slice()
    msgs.length = 0
    return out
  }
  const find = <T extends Ev['t']>(t: T) =>
    msgs.find((m): m is Extract<Ev, { t: T }> => m.t === t)
  const waitFor = <T extends Ev['t']>(t: T, timeoutMs = 250) =>
    new Promise<Extract<Ev, { t: T }>>((resolve, reject) => {
      const start = Date.now()
      const tick = () => {
        const ev = find(t)
        if (ev) return resolve(ev)
        if (Date.now() - start >= timeoutMs)
          return reject(new Error(`Timeout waiting for ${t}`))
        setTimeout(tick, 0)
      }
      tick()
    })
  return { remote, msgs, takeAll, find, waitFor }
}

describe('vm.service (integration, real VM)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('init -> ready', async () => {
    const { remote, waitFor } = await harness()
    await remote.init(0x100)
    await waitFor('ready')
    expect(true).toBe(true)
  })

  it('load success sets IP and posts snapshot', async () => {
    const { remote, takeAll, waitFor } = await harness()
    await remote.init(0x100)
    takeAll()
    await remote.load(new Uint8Array([1, 2, 3]), 0x0042)
    const snap = await waitFor('snapshot')
    expect(snap.snap.ip).toBe(0x0042)
  })

  it('load beyond RAM => paused:fault with meta.addr', async () => {
    const { remote, takeAll, waitFor } = await harness()
    await remote.init(8)
    takeAll()
    await remote.load(new Uint8Array(16), 0x0000)
    const paused = await waitFor('paused')
    expect(paused.reason).toBe('fault')
    // first failing address after writing 0..7
    expect(paused.fault?.meta?.addr).toBe(8)
    // also posts a snapshot after fault
    await waitFor('snapshot')
    expect(true).toBe(true)
  })

  it('breakpoint pauses before executing at IP (run path)', async () => {
    const { remote, takeAll, waitFor } = await harness()
    await remote.init(0x100)
    await remote.load(new Uint8Array([1, 1, 1]), 0x0000)
    takeAll()
    await remote.setBreakpoints([0x0000])
    await remote.run()
    const paused = await waitFor('paused')
    expect(paused.reason).toBe('breakpoint')
    expect(paused.ip).toBe(0x0000)
    const snap = await waitFor('snapshot')
    expect(snap.snap.ip).toBe(0x0000)
  })

  it('breakpoint pauses before executing at IP (step path)', async () => {
    const { remote, takeAll, waitFor } = await harness()
    await remote.init(0x200)
    await remote.load(new Uint8Array([1, 1, 1]), 0x0100)
    takeAll()
    await remote.setBreakpoints([0x0100])
    await remote.step(5)
    const paused = await waitFor('paused')
    expect(paused.reason).toBe('breakpoint')
    expect(paused.ip).toBe(0x0100)
    const snap = await waitFor('snapshot')
    expect(snap.snap.ip).toBe(0x0100)
  })

  it('peek returns mem buffer (even partial) and faults on OOB', async () => {
    const { remote, takeAll, find, msgs, waitFor } = await harness()
    await remote.init(8)
    await remote.load(new Uint8Array([9, 8, 7, 6]), 0x0000)
    takeAll()
    await remote.peek(6, 4, 7) // 6,7 ok; 8,9 OOB
    const mem = await waitFor('mem')
    expect(mem.reqId).toBe(7)
    expect(mem.data.byteLength).toBe(4)

    const paused = find('paused')!
    expect(paused.reason).toBe('fault')
    expect(paused.fault?.meta?.addr).toBe(8)

    const memIdx = msgs.findIndex((e) => e.t === 'mem')
    const pausedIdx = msgs.findIndex((e) => e.t === 'paused')
    expect(pausedIdx).toBeGreaterThan(memIdx)
  })

  it('poke faults with precise failing addr', async () => {
    const { remote, takeAll, msgs, waitFor } = await harness()
    await remote.init(8)
    takeAll()
    await remote.poke(6, new Uint8Array([1, 2, 3]))
    const paused = await waitFor('paused')
    expect(paused.reason).toBe('fault')
    expect(paused.fault?.meta?.addr).toBe(8)
    // no mem event for poke
    expect(msgs.some((e) => e.t === 'mem')).toBe(false)
  })

  it('poke writes are visible via subsequent peek', async () => {
    const { remote, takeAll, waitFor } = await harness()
    await remote.init(8)
    takeAll()
    await remote.poke(2, new Uint8Array([9, 8, 7]))
    await remote.peek(0, 5, 1)
    const mem = await waitFor('mem')
    expect(Array.from(mem.data)).toEqual([0, 0, 9, 8, 7])
  })

  it('setReg posts a snapshot reflecting the updated value', async () => {
    const { remote, takeAll, waitFor } = await harness()
    await remote.init(0x100)
    takeAll()
    await remote.setReg('ip', 0x0042)
    const snap = await waitFor('snapshot')
    expect(snap.snap.ip).toBe(0x0042)
  })

  it('pause and reset cancel run loop', async () => {
    const { remote, takeAll, find, msgs, waitFor } = await harness()
    await remote.init(0x100)
    await remote.load(new Uint8Array([1, 1, 1]), 0x0000)
    takeAll()
    await remote.run()
    takeAll()
    await remote.pause()
    const paused = await waitFor('paused')
    expect(['manual', 'fault']).toContain(paused.reason)
    takeAll()
    await remote.reset()
    const snap = find('snapshot')!
    expect(snap.snap).toBeTruthy()

    // ensure no stray events from the old loop
    const stray = msgs.find(
      (e) => e.t === 'tick' || (e.t === 'paused' && e.reason !== 'manual')
    )
    expect(stray).toBeUndefined()
  })
})
