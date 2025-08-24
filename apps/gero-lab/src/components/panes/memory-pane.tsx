import { useVM } from '@/contexts/vm-context'
import { fmt16, fmt8, u16 } from '@gero/util'
import { useEffect, useMemo, useState } from 'react'
import { SectionCard } from '../section-card'
import { Label } from '../ui/label'
import { cn } from '@/lib/utils'
import { HexInput } from '../ui/hex-input'
import { Separator } from '../ui/separator'

type MemoryPaneProps = {
  base: number
  length: number
  highlightAddrs?: number[]
  onJump: (addr: number) => void
}

export function MemoryPane({
  base,
  length,
  highlightAddrs,
  onJump,
}: MemoryPaneProps) {
  const vm = useVM()
  const [buf, setBuf] = useState<Uint8Array | null>(null)
  const [mask, setMask] = useState<Uint8Array | null>(null)
  const [memSize, setMemSize] = useState<number>(0)

  useEffect(() => {
    vm.memSize()
      .then(setMemSize)
      .catch(() => setMemSize(0))
    Promise.all([vm.peek(base, length), vm.peekMask(base, length)])
      .then(([d, m]) => {
        setBuf(d)
        setMask(m)
      })
      .catch(() => {
        setBuf(null)
        setMask(null)
      })
  }, [vm, base, length])

  const rows = useMemo(() => {
    if (!buf) return []
    const list: { addr: number; bytes: number[] }[] = []
    for (let i = 0; i < buf.length; i += 16) {
      const abs = base + i
      if (memSize && abs >= memSize) break
      list.push({
        addr: abs,
        bytes: Array.from(buf.slice(i, i + 16)),
      })
    }
    return list
  }, [buf, base, memSize])

  const isHighlight = (addr: number) =>
    highlightAddrs?.some((a) => u16(a) === u16(addr))

  const isAscii = (b: number) => b >= 32 && b <= 126

  return (
    <SectionCard title="Working memory">
      <div className="h-full overflow-auto">
        <div className="py-2 flex items-center gap-2">
          <Label>Memory @</Label>
          <HexInput
            name="memBase"
            value={fmt16(base, true)}
            onEnter={(s) => {
              const v = parseInt(s || '0', 16)
              if (!Number.isNaN(v)) onJump(u16(v))
            }}
          />
        </div>
        {rows.map((r) => (
          <div
            key={r.addr}
            className="grid grid-cols-[5rem_1fr] py-1 border-b border-zinc-900 text-sm"
          >
            <div className="opacity-60">{fmt16(r.addr)}</div>
            <div className="flex gap-2">
              <div className="grid grid-cols-16 gap-1">
                {r.bytes.map((b, i) => {
                  const a = u16(r.addr + i)
                  const inited = mask
                    ? Boolean(mask[i + (r.addr - base)] ?? 0)
                    : true
                  const oob = memSize ? r.addr + i >= memSize : false
                  const display = !oob && inited ? fmt8(b, true) : '__'
                  return (
                    <span
                      key={i}
                      className={cn(
                        'shrink-0 w-6 inline-block text-center font-mono',
                        !inited || oob ? 'text-muted' : '',
                        isHighlight(a) ? 'bg-amber-500/20 rounded' : ''
                      )}
                    >
                      {display}
                    </span>
                  )
                })}
              </div>
              <Separator orientation="vertical" />
              <div>
                {r.bytes.map((b, i) => {
                  const inited = mask
                    ? Boolean(mask[i + (r.addr - base)] ?? 0)
                    : true
                  const oob = memSize ? r.addr + i >= memSize : false
                  if (oob || !inited) {
                    return (
                      <span key={i} className="shrink-0 text-center text-muted">
                        .
                      </span>
                    )
                  }
                  const c = isAscii(b) ? String.fromCharCode(b) : '.'
                  return (
                    <span
                      key={b}
                      className={cn(
                        'shrink-0 text-center',
                        isAscii(b) ? 'text-zinc-300' : 'text-zinc-600'
                      )}
                    >
                      {c}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
