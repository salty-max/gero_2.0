import type { Ev, Snapshot, Fault } from '@/lib/protocol'
import type { RegName } from '@gero/vm'
import { useCallback, useEffect, useRef, useState } from 'react'
import { wrap, proxy, type Remote } from 'comlink'
import WorkerCtor from '@/lib/vm.worker.ts?worker'
import type { VMService } from '@/lib/vm.service'

type EvHandler = (ev: Ev) => void

export function useVMService({ memorySize = 0x10000, ivAddr = 0x1000 } = {}) {
  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const lastFaultRef = useRef<Fault | null>(null)
  const listeners = useRef(new Map<Ev['t'], Set<(ev: Ev) => void>>())

  const apiRef = useRef<Remote<VMService> | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    const w = new (WorkerCtor as unknown as { new (): Worker })()
    workerRef.current = w
    const api = wrap<VMService>(w as unknown as Worker)
    apiRef.current = api

    const onEvent = (ev: Ev) => {
      if (ev.t === 'ready') setReady(true)
      if (ev.t === 'snapshot') setSnap(ev.snap)
      if (ev.t === 'paused') {
        setRunning(false)
        if (ev.reason === 'fault') lastFaultRef.current = ev.fault ?? null
      }
      if (ev.t === 'tick') setRunning(true)
      const set = listeners.current.get(ev.t)
      if (set) set.forEach((fn) => fn(ev))
    }

    api.setOnEvent(proxy(onEvent))
    api.init(memorySize, ivAddr)

    return () => {
      try {
        w.terminate()
      } catch {
        console.error('Could not terminate worker')
      }
      workerRef.current = null
      apiRef.current = null
    }
  }, [memorySize, ivAddr])

  const on = useCallback(
    <T extends Ev['t']>(t: T, fn: (ev: Extract<Ev, { t: T }>) => void) => {
      const map = listeners.current
      const set = map.get(t) ?? new Set()
      set.add(fn as EvHandler)
      map.set(t, set)
      return () => set.delete(fn as EvHandler)
    },
    []
  )

  const load = useCallback(
    (bytes: Uint8Array, start: number, entryIp?: number) => {
      apiRef.current?.load(bytes, start, entryIp)
    },
    []
  )
  const run = useCallback(() => {
    void apiRef.current?.run()
  }, [])
  const pause = useCallback(() => {
    void apiRef.current?.pause()
  }, [])
  const step = useCallback((n = 1) => {
    void apiRef.current?.step(n)
  }, [])
  const reset = useCallback(() => {
    void apiRef.current?.reset()
  }, [])
  const setBreakpoints = useCallback((addrs: number[]) => {
    void apiRef.current?.setBreakpoints(addrs)
  }, [])
  const setReg = useCallback((reg: RegName, value: number) => {
    void apiRef.current?.setReg(reg, value)
  }, [])
  const setEntry = useCallback((entryIp: number) => {
    void apiRef.current?.setEntry(entryIp)
  }, [])
  const setStepDelay = useCallback((delayMs: number) => {
    void apiRef.current?.setStepDelay(delayMs)
  }, [])
  const peek = useCallback((addr: number, len: number, reqId?: number) => {
    const api = apiRef.current
    if (!api) return Promise.reject(new Error('worker not ready'))
    return Promise.resolve(
      api.peek(addr, len, reqId) as Promise<Uint8Array> | Uint8Array
    )
  }, [])

  return {
    ready,
    running,
    snap,
    lastFaultRef,
    on,
    load,
    run,
    pause,
    step,
    reset,
    setBreakpoints,
    setReg,
    setEntry,
    setStepDelay,
    peek,
  }
}
