import type { LogEntry } from '@/hooks/use-vm-log'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { SectionCard } from '../section-card'
import {
  BrushCleaningIcon,
  CopyIcon,
  EyeClosedIcon,
  EyeIcon,
} from 'lucide-react'

const KIND_COLOR: Record<string, string> = {
  info: 'text-zinc-300',
  read: 'text-zinc-300',
  snapshot: 'text-cyan-300',
  paused: 'text-amber-300',
  tick: 'text-zinc-400',
  mem: 'text-violet-300',
}

type LogPaneProps = {
  entries: LogEntry[]
  clear: () => void
  copy: () => void
  height?: number
}

export function LogPane({ entries, clear, copy, height = 180 }: LogPaneProps) {
  const [show, setShow] = useState(true)
  const [filters, _setFilters] = useState<Record<LogEntry['kind'], boolean>>({
    ready: true,
    info: true,
    snapshot: true,
    paused: true,
    mem: true,
    tick: false,
    pong: false,
    trace: false,
  })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const filtered = useMemo(
    () => entries.filter((e) => filters[e.kind] ?? true),
    [entries, filters]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (autoScroll) el.scrollTop = el.scrollHeight
  }, [filtered, autoScroll])

  return (
    <div className={cn(show ? '' : 'opacity-50')}>
      <SectionCard
        title="Logs"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-xs"
              size="icon"
              onClick={copy}
            >
              <CopyIcon />
            </Button>
            <Button
              variant="outline"
              className="text-xs"
              size="icon"
              onClick={clear}
            >
              <BrushCleaningIcon />
            </Button>

            <Button
              variant="outline"
              className="text-xs"
              size="icon"
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeClosedIcon /> : <EyeIcon />}
            </Button>
          </div>
        }
      >
        {show && (
          <div
            ref={containerRef}
            className={`overflow-auto px-3 max-h-[${height}px]`}
            onScroll={(e) => {
              const el = e.currentTarget
              const atBottom =
                el.scrollTop + el.clientHeight >= el.scrollHeight - 4
              setAutoScroll(atBottom)
            }}
          >
            {filtered.map((e) => (
              <LogRow key={e.id} entry={e} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

type LogRowProps = {
  entry: LogEntry
}

function LogRow({ entry }: LogRowProps) {
  const ts = new Date(entry.t)
  const hh = ts.getHours().toString().padStart(2, '0')
  const mm = ts.getMinutes().toString().padStart(2, '0')
  const ss = ts.getSeconds().toString().padStart(2, '0')
  const ms = ts.getMilliseconds().toString().padStart(3, '0')

  const [open, setOpen] = useState(false)
  const color = KIND_COLOR[entry.kind] ?? 'text-zinc-300'

  return (
    <div className="py-0.5 border-b border-zinc-900 text-xs h-[36px]">
      <div className="flex items-center gap-3 h-full">
        <span className="text-zinc-500 w-21">
          {hh}:{mm}:{ss}.{ms}
        </span>
        <span className={cn('w-20', color)}>{entry.kind}</span>
        <span className="flex-1">{entry.summary}</span>
        {entry.details && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <EyeClosedIcon /> : <EyeIcon />}
          </Button>
        )}
      </div>
      {open && entry.details && (
        <pre className="mt-1 ml-[10rem] mr-2 p-2 bg-zinc-900/50 rounded text-zinc-300 whitespace-pre-wrap break-all">
          {typeof entry.details === 'string'
            ? entry.details
            : JSON.stringify(entry.details, null, 2)}
        </pre>
      )}
    </div>
  )
}
