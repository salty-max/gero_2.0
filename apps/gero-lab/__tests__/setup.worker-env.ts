import { vi } from 'vitest'
import { Cmd, Ev } from '../src/lib/protocol'
export {}

type WorkerMessageEvent<T> = { data: T }

type WorkerSelf = {
  onmessage: ((e: { data: WorkerMessageEvent<Cmd> }) => void) | null
  postMessage: (data: Ev, transfer?: Transferable[]) => void
}

const fakeSelf: WorkerSelf = {
  onmessage: null,
  postMessage: () => {},
}

vi.stubGlobal('self', fakeSelf)
