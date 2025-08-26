import type { Ev } from '@/lib/protocol'
import { fmt16 } from '@gero/util'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type LogKind =
  | Ev['t']
  | 'info'
  | 'fault'
  | 'stack'
  | 'irq'
  | 'im'
  | 'bp'
  | 'run'
  | 'load'
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
  includeStack?: boolean // include 'trace' entries when SP/FP change
}

type Filters = Record<LogEntry['kind'], boolean>

const FILTERS_STORAGE_KEY = 'gero:logFilters:v1'

const defaultFilters: Filters = {
  ready: true,
  info: true,
  snapshot: false,
  paused: true,
  fault: true,
  mem: false,
  tick: false,
  pong: false,
  stack: true,
  irq: true,
  im: true,
  bp: true,
  run: true,
  load: true,
  trace: true,
}

export function useVMLog(
  on: <T extends Ev['t']>(
    t: T,
    fn: (ev: Extract<Ev, { t: T }>) => void
  ) => () => void,
  {
    max = 500,
    includeTick = false,
    tickSample = 32,
    includeStack = true,
  }: UseVmLogOpts = {},
  alreadyReady?: boolean
) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filters, setFilters] = useState<Record<LogEntry['kind'], boolean>>(
    () => {
      try {
        if (typeof window === 'undefined') return defaultFilters
        const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
        if (!raw) return defaultFilters
        const parsed = JSON.parse(raw) as Record<string, unknown>
        if (!parsed || typeof parsed !== 'object') return defaultFilters
        const next = { ...defaultFilters }
        for (const k of Object.keys(defaultFilters)) {
          const v = parsed[k]
          if (typeof v === 'boolean') next[k as LogEntry['kind']] = v
        }
        return next
      } catch {
        return defaultFilters
      }
    }
  )
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
            kind: 'fault',
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

    // Interrupt lifecycle
    unsub.push(
      on('irq', (e) => {
        push({
          id: ++counter.current,
          t: Date.now(),
          kind: 'irq',
          summary: `irq ${e.phase} @ ip=${fmt16(e.ip)}`,
        })
      })
    )

    // Interrupt mask changes
    unsub.push(
      on('im', (e) => {
        push({
          id: ++counter.current,
          t: Date.now(),
          kind: 'im',
          summary: `im ${fmt16(e.from)}→${fmt16(e.to)}`,
        })
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

    if (includeStack) {
      unsub.push(
        on('trace', (e) => {
          const before = e.before
          const after = e.after
          if (!before || !after) return
          const dSP = (after.sp - before.sp) & 0xffff
          const dFP = (after.fp - before.fp) & 0xffff

          if (dSP === 0 && dFP === 0) return

          let kind: LogKind = 'stack'
          let summary = ''

          const spDown = before.sp > after.sp
          const spUp = before.sp < after.sp
          const fpDown = before.fp > after.fp
          const fpUp = before.fp < after.fp

          if (after.fp === after.sp && spDown) {
            // Frame prologue (call/interrupt)
            const words = ((before.sp - after.sp) & 0xffff) / 2
            kind = 'stack'
            summary = `prologue ip=${fmt16(e.ip)}: push ${words}w, fp=${fmt16(after.fp)}`
          } else if (spUp && fpUp) {
            // Frame epilogue (ret). Often SP ends up == FP
            const spWords = ((after.sp - before.sp) & 0xffff) / 2
            const fpWords = ((after.fp - before.fp) & 0xffff) / 2
            kind = 'stack'
            summary = `epilogue ip=${fmt16(e.ip)}: sp+=${spWords}w, fp+=${fpWords}w`
          } else if (spDown && !fpDown && !fpUp) {
            // Push N
            const words = ((before.sp - after.sp) & 0xffff) / 2
            kind = 'stack'
            summary = `push ip=${fmt16(e.ip)}: -${words}w (sp ${fmt16(before.sp)}→${fmt16(after.sp)})`
          } else if (spUp && !fpDown && !fpUp) {
            // Pop N
            const words = ((after.sp - before.sp) & 0xffff) / 2
            kind = 'stack'
            summary = `pop ip=${fmt16(e.ip)}: +${words}w (sp ${fmt16(before.sp)}→${fmt16(after.sp)})`
          } else {
            // Generic adjust
            const parts: string[] = []
            if (before.sp !== after.sp)
              parts.push(`sp ${fmt16(before.sp)}→${fmt16(after.sp)}`)
            if (before.fp !== after.fp)
              parts.push(`fp ${fmt16(before.fp)}→${fmt16(after.fp)}`)
            summary = `stack ip=${fmt16(e.ip)}: ${parts.join(', ')}`
          }

          push({
            id: ++counter.current,
            t: Date.now(),
            kind,
            summary,
            details: { before, after },
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

    // Run started
    unsub.push(
      on('run', (e) => {
        push({
          id: ++counter.current,
          t: Date.now(),
          kind: 'run',
          summary: `starting @ ip=${fmt16(e.ip)}`,
        })
      })
    )

    // Program loaded
    unsub.push(
      on('load', (e) => {
        push({
          id: ++counter.current,
          t: Date.now(),
          kind: 'load',
          summary: `load size=${e.size} start=${fmt16(e.start)} entry=${fmt16(e.entry)}`,
          details: { size: e.size, start: e.start, entry: e.entry },
        })
      })
    )

    // Breakpoints changed
    unsub.push(
      on('bp', (e) => {
        const add = e.add.map((a) => fmt16(a)).join(', ')
        const rem = e.remove.map((a) => fmt16(a)).join(', ')
        const parts = [] as string[]
        if (e.add.length) parts.push(`+${e.add.length} [${add}]`)
        if (e.remove.length) parts.push(`-${e.remove.length} [${rem}]`)
        push({
          id: ++counter.current,
          t: Date.now(),
          kind: 'bp',
          summary: `bp ${parts.join(' ')} total=${e.total}`,
        })
      })
    )

    return () => {
      unsub.forEach((u) => u())
    }
  }, [on, includeTick, includeStack, tickSample, push])

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
  const filteredEntries = useMemo(
    () => entries.filter((e) => filters[e.kind] ?? true),
    [entries, filters]
  )

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // ignore
    }
  }, [filters])

  return {
    entries,
    filteredEntries,
    filters,
    setFilters,
    clear,
    copytoClipboard,
  }
}
