import type { Ev } from '@/lib/protocol'
import { fmt16 } from '@gero/util'
import { useCallback, useEffect, useRef, useState } from 'react'

export type LogKind = Ev['t'] | 'info'
export type LogEntry = {
  id: number
  t: number // epoch ms
  kind: LogKind
  summary: string
  details?: Record<string, unknown> | string
}

const short = (s: string, n = 120) => (s.length > n ? s.slice(0, n) + '...' : s)

export type UseVmLogOpts = {
  max?: number
  includeTick?: boolean
  tickSample?: number // keep every nth tick
}

export function useVMLog(
  on: <T extends Ev['t']>(
    t: T,
    fn: (ev: Extract<Ev, { t: T }>) => void
  ) => () => void,
  { max = 500, includeTick = false, tickSample = 32 }: UseVmLogOpts = {},
  alreadyReady?: boolean
) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const counter = useRef(0)
  const tickCount = useRef(0)
  const seenReady = useRef(false)

  const push = useCallback(
    (e: LogEntry) => {
      setEntries((prev) => {
        const next = [...prev, e]
        if (next.length > max) next.splice(0, next.length - max)
        return next
      })
    },
    [max]
  )

  useEffect(() => {
    const unsub: Array<() => void> = []

    unsub.push(
      on('ready', () => {
        if (seenReady.current) return
        seenReady.current = true
        push({
          id: ++counter.current,
          t: Date.now(),
          kind: 'ready',
          summary: 'worker ready',
        })
      })
    )

    unsub.push(
      on('snapshot', (e) => {
        const s = e.snap
        push({
          id: ++counter.current,
          t: Date.now(),
          kind: 'snapshot',
          summary: `snapshot ip=${fmt16(s.ip)} sp=${fmt16(s.sp)} fp=${fmt16(s.fp)}`,
          details: s,
        })
      })
    )

    unsub.push(
      on('paused', (e) => {
        let summary = `paused: ${e.reason}`
        if ('ip' in e) summary += ` @ ${fmt16(e.ip)}`
        if (e.reason === 'fault') {
          const f = e.fault
          summary += f?.code ? ` [${f.code}]` : ''
          if (f?.meta && typeof f.meta.addr === 'number')
            summary += ` addr=${fmt16(f.meta.addr)}`

          push({
            id: ++counter.current,
            t: Date.now(),
            kind: 'paused',
            summary,
            details: {
              msg: f?.msg,
              code: f?.code,
              meta: f?.meta,
            },
          })
          return
        }

        push({ id: ++counter.current, t: Date.now(), kind: 'paused', summary })
      })
    )

    if (includeTick) {
      unsub.push(
        on('tick', (e) => {
          const n = ++tickCount.current
          if (n % tickSample !== 0) return
          push({
            id: ++counter.current,
            t: Date.now(),
            kind: 'tick',
            summary: `tick ip=${fmt16(e.ip)}`,
          })
        })
      )
    }

    unsub.push(
      on('mem', (e) => {
        const showReq = typeof e.reqId === 'number'
        push({
          id: ++counter.current,
          t: Date.now(),
          kind: 'mem',
          summary: `mem addr=${fmt16(e.addr)} len=${e.data.byteLength}${showReq ? ` (req ${e.reqId})` : ''}`,
        })
      })
    )

    return () => {
      unsub.forEach((u) => u())
    }
  }, [on, includeTick, tickSample, push])

  // If the VM is already ready (e.g., due to effect ordering or HMR),
  // emit a single ready entry on mount.
  useEffect(() => {
    if (!alreadyReady || seenReady.current) return
    seenReady.current = true
    push({
      id: ++counter.current,
      t: Date.now(),
      kind: 'info',
      summary: 'worker ready',
    })
  }, [alreadyReady, push])

  const clear = useCallback(() => setEntries([]), [])
  const copytoClipboard = useCallback(async () => {
    const lines = entries.map((e) => {
      const ts = new Date(e.t).toISOString().split('T')[1]!.replace('Z', '')
      const d =
        typeof e.details === 'string'
          ? e.details
          : e.details
            ? JSON.stringify(e.details)
            : ''
      return `[${ts}] ${e.kind.padEnd(9)} ${e.summary}${d ? ` :: ${short(d, 500)}` : ''}`
    })

    await navigator.clipboard.writeText(lines.join('\n'))
  }, [entries])

  return { entries, clear, copytoClipboard }
}
