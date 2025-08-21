import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeWorker } from './fake.worker'

describe('VMClient (integration via FakeWorker)', () => {
  beforeEach(() => {
    vi.resetModules()
    // Provide a Worker polyfill for the client under test
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
  })

  it('init posts ready and on("ready") receives it', async () => {
    const { VMClient } = await import('../src/lib/vm-client')
    const client = new VMClient()

    const gotReady = new Promise<void>((resolve) => {
      client.on('ready', () => resolve())
    })

    client.init(0x100)
    await gotReady
    client.dispose()
  })

  it('load emits snapshot; listener sees updated IP', async () => {
    const { VMClient } = await import('../src/lib/vm-client')
    const client = new VMClient()
    const got = new Promise<number>((resolve) =>
      client.on('snapshot', (e) => resolve(e.snap.ip))
    )

    client.init(0x200)
    client.load(new Uint8Array([1, 2, 3]), 0x42)

    const ip = await got
    expect(ip).toBe(0x42)
    client.dispose()
  })

  it('peek resolves data and also emits a mem event to listeners', async () => {
    const { VMClient } = await import('../src/lib/vm-client')
    const client = new VMClient()

    // Fill memory at 0x10..0x12
    client.init(0x100)
    client.load(new Uint8Array([9, 8, 7]), 0x10)

    const seen: Array<{ addr: number; len: number }> = []
    client.on('mem', (e) => seen.push({ addr: e.addr, len: e.data.length }))

    const data = await client.peek(0x10, 3)
    expect(Array.from(data)).toEqual([9, 8, 7])

    // Check that the mem event also fanned out to listeners
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1]).toEqual({ addr: 0x10, len: 3 })
    client.dispose()
  })

  it('on() returns an unsubscribe that stops further notifications', async () => {
    const { VMClient } = await import('../src/lib/vm-client')
    const client = new VMClient()
    client.init(0x80)

    let count = 0
    let resolveFirst!: () => void
    const first = new Promise<void>((resolve) => (resolveFirst = resolve))
    const off = client.on('snapshot', () => {
      count++
      resolveFirst()
    })

    client.load(new Uint8Array([1]), 0)
    await first
    expect(count).toBe(1)

    off() // unsubscribe
    client.load(new Uint8Array([2]), 1)
    // give time for any stray notifications (should be none)
    await new Promise((r) => setTimeout(r, 10))
    expect(count).toBe(1)
    client.dispose()
  })

  it('pause posts paused(manual) and snapshot via listeners', async () => {
    const { VMClient } = await import('../src/lib/vm-client')
    const client = new VMClient()
    client.init(0x100)
    client.load(new Uint8Array([1, 1, 1]), 0)

    const gotPaused = new Promise<{ reason: string }>((resolve) =>
      client.on('paused', (e) => resolve({ reason: e.reason }))
    )
    const gotSnap = new Promise<void>((resolve) =>
      client.on('snapshot', () => resolve())
    )

    // Directly pause without running; worker should still emit paused(manual)
    client.pause()

    const p = await gotPaused
    expect(p.reason).toBe('manual')
    await gotSnap
    client.dispose()
  })

  it('setBreakpoints + run pauses before executing at IP', async () => {
    const { VMClient } = await import('../src/lib/vm-client')
    const client = new VMClient()
    client.init(0x100)
    client.load(new Uint8Array([1, 1, 1]), 0x0000)

    const got = new Promise<number>((resolve) =>
      client.on('paused', (e) => e.reason === 'breakpoint' && resolve(e.ip))
    )

    client.setBreakpoints([0x0000])
    client.run()
    const ip = await got
    expect(ip).toBe(0x0000)
    client.dispose()
  })

  it('setReg posts a snapshot reflecting the updated value', async () => {
    const { VMClient } = await import('../src/lib/vm-client')
    const client = new VMClient()
    client.init(0x100)
    client.load(new Uint8Array([1, 1]), 0x0020)

    const got = new Promise<number>((resolve) =>
      client.on('snapshot', (e) => e.snap.ip === 0x0042 && resolve(e.snap.ip))
    )

    client.setReg('ip', 0x0042)
    const ip = await got
    expect(ip).toBe(0x0042)
    client.dispose()
  })

  it('concurrent peek requests resolve to their respective data', async () => {
    const { VMClient } = await import('../src/lib/vm-client')
    const client = new VMClient()
    client.init(0x100)
    client.load(new Uint8Array([1, 2, 3, 4, 5, 6]), 0x0010)

    const p1 = client.peek(0x0010, 2) // [1,2]
    const p2 = client.peek(0x0013, 3) // [4,5,6]
    const [a, b] = await Promise.all([p1, p2])
    expect(Array.from(a)).toEqual([1, 2])
    expect(Array.from(b)).toEqual([4, 5, 6])
    client.dispose()
  })
})
