import type { LogEntry } from '@/hooks/use-vm-log'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { SectionCard } from '../section-card'
import {
  BrushCleaningIcon,
  CopyIcon,
  EyeClosedIcon,
  EyeIcon,
} from 'lucide-react'
import { ScrollArea } from '../ui/scroll-area'
import { LogFilters } from '../log-filters'

const KIND_COLOR: Record<string, string> = {
  info: 'text-[color:var(--ctp-subtext0)]',
  read: 'text-[color:var(--ctp-subtext0)]',
  snapshot: 'text-[color:var(--ctp-sky)]',
  paused: 'text-[color:var(--ctp-peach)]',
  fault: 'text-[color:var(--ctp-red)]',
  tick: 'text-[color:var(--ctp-overlay1)]',
  mem: 'text-[color:var(--ctp-sapphire)]',
  stack: 'text-[color:var(--ctp-teal)]',
  irq: 'text-[color:var(--ctp-peach)]',
  im: 'text-[color:var(--ctp-pink)]',
  bp: 'text-[color:var(--ctp-yellow)]',
  run: 'text-[color:var(--ctp-green)]',
  load: 'text-[color:var(--ctp-blue)]',
}

type LogPaneProps = {
  entries: LogEntry[]
  clear: () => void
  copy: () => void
  height?: number
  filters: Record<LogEntry['kind'], boolean>
  setFilters: (f: Record<LogEntry['kind'], boolean>) => void
}

export function LogPane({
  entries,
  clear,
  copy,
  height = 232,
  filters,
  setFilters,
}: LogPaneProps) {
  const [show, setShow] = useState(true)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    // Use a sentinel so we scroll the correct container even if layout changes
    const doScroll = () => {
      if (bottomRef.current) {
        try {
          bottomRef.current.scrollIntoView({ block: 'end' })
          return
        } catch {
          // pass
        }
      }
      const vp = viewportRef.current
      if (vp) vp.scrollTop = vp.scrollHeight
    }
    // Defer to next frame to let DOM/layout settle
    if (typeof requestAnimationFrame === 'function')
      requestAnimationFrame(doScroll)
    else doScroll()
  }

  useEffect(() => {
    scrollToBottom()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [entries.length])

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

            <LogFilters filters={filters} setFilters={setFilters} />

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
          <ScrollArea
            className="px-3"
            style={{ height }}
            viewportRef={viewportRef}
          >
            <div>
              {entries.map((e) => (
                <LogRow key={e.id} entry={e} />
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
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
    <div className="relative py-0.5 border-b border-zinc-900 text-xs h-[36px]">
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
        <pre className="absolute z-10 mt-1 ml-[10rem] p-2 bg-zinc-900 rounded text-zinc-300 whitespace-pre-wrap break-all">
          {typeof entry.details === 'string'
            ? entry.details
            : JSON.stringify(entry.details, null, 2)}
        </pre>
      )}
    </div>
  )
}
