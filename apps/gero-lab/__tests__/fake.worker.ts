import type { Cmd, Ev } from '../src/lib/protocol'

// Minimal in-process Worker polyfill for tests.
// It spins up a fresh instance of the real vm.worker.ts module,
// wiring its `self.postMessage` to this class's `onmessage`.
export class FakeWorker {
  onmessage: ((e: MessageEvent<Ev>) => void) | null = null

  private innerSelf: {
    onmessage: ((e: MessageEvent<Cmd>) => void) | null
    postMessage: (data: Ev, transfer?: Transferable[]) => void
  }
  private ready: Promise<unknown>
  private queue: Cmd[] = []

  constructor(url: URL) {
    // Create an isolated worker-like global for the module under test.
    this.innerSelf = {
      onmessage: null,
      postMessage: (data: Ev) => {
        // Bridge from worker -> main thread
        this.onmessage?.({ data } as MessageEvent<Ev>)
      },
    }

    // Temporarily swap in our inner self, import the worker module, then restore.
    ;(globalThis as any).self = this.innerSelf

    // Try to import using the provided file URL; fall back to a relative path.
    const href = String(url?.href ?? '')
    this.ready = (href ? import(href) : import('../src/lib/vm.worker.ts'))
      .catch((e) => {
        // Surface import issues early for easier debugging
        setTimeout(() => {
          throw e
        }, 0)
      })
      .then(() => {
        // Flush any queued messages once handler is installed
        const handler = this.innerSelf.onmessage
        if (handler) {
          for (const msg of this.queue) handler({ data: msg } as MessageEvent<Cmd>)
          this.queue.length = 0
        }
      })
  }

  postMessage(data: Cmd) {
    // Bridge from main -> worker
    const handler = this.innerSelf.onmessage
    if (handler) handler({ data } as MessageEvent<Cmd>)
    else this.queue.push(data)
  }

  terminate() {
    // no-op for tests
  }
}
