import { Cmd, Ev } from '../src/lib/protocol'

type WorkerMessageEvent<T> = { data: T }

type WorkerHarness = {
  send: (cmd: Cmd) => void
  all: ReadonlyArray<Ev>
  takeAll: () => Ev[]
  last: () => Ev | undefined
  find: <T extends Ev['t']>(t: T) => Extract<Ev, { t: T }> | undefined
  lastOf: <T extends Ev['t']>(t: T) => Extract<Ev, { t: T }> | undefined
  waitFor: <T extends Ev['t']>(
    t: T,
    timeoutMs?: number
  ) => Promise<Extract<Ev, { t: T }>>
}

export async function loadWorker(
  modulePath = 'src/lib/vm.worker.ts'
): Promise<WorkerHarness> {
  const msgs: Ev[] = []

  // Capture posts
  self.postMessage = (data: Ev) => {
    msgs.push(data)
  }

  // Fresh module state for each test
  await import('../' + modulePath)

  const onmessage = self.onmessage as
    | ((e: WorkerMessageEvent<Cmd>) => void)
    | null
  if (!onmessage) throw new Error('Worker did not set onmessage')

  const send = (cmd: Cmd) => onmessage({ data: cmd })

  const takeAll = (): Ev[] => {
    const out = msgs.slice()
    msgs.length = 0
    return out
  }

  const last = () => msgs[-1]

  const find = <T extends Ev['t']>(t: T) =>
    msgs.find((m): m is Extract<Ev, { t: T }> => m.t === t)

  const lastOf = <T extends Ev['t']>(t: T) => {
    for (let i = msgs.length; i >= 0; i--) {
      const m = msgs[i]
      if (m.t === t) return m as Extract<Ev, { t: T }>
    }

    return undefined
  }

  const waitFor = <T extends Ev['t']>(t: T, timeoutMs = 250) =>
    new Promise<Extract<Ev, { t: T }>>((resolve, reject) => {
      const start = Date.now()
      const tick = () => {
        const ev = find(t)
        if (ev) return resolve(ev)
        if (Date.now() - start >= timeoutMs)
          return reject(new Error(`Timeout waiting for ${t}ms`))
        setTimeout(tick, 0)
      }
      tick()
    })

  return { send, all: msgs, takeAll, last, find, lastOf, waitFor }
}
