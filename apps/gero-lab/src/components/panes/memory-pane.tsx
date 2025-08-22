import type { useVM } from '@/hooks/use-vm'
import { fmt16, fmt8 } from '@gero/util'
import { u16 } from '@gero/vm'
import { useEffect, useMemo, useState } from 'react'
import { SectionCard } from '../section-card'

type MemoryPaneProps = {
  vm: ReturnType<typeof useVM>
  base: number
  length: number
  highlightAddrs?: number[]
  onJump: (addr: number) => void
}

export function MemoryPane({
  vm,
  base,
  length,
  highlightAddrs,
  onJump,
}: MemoryPaneProps) {
  const [buf, setBuf] = useState<Uint8Array | null>(null)

  useEffect(() => {
    vm.peek(base, length)
      .then((d) => {
        setBuf(d)
      })
      .catch(() => setBuf(null))
  }, [vm, base, length])

  const rows = useMemo(() => {
    if (!buf) return []
    const list: { addr: number; bytes: number[] }[] = []
    for (let i = 0; i < buf.length; i += 16) {
      list.push({
        addr: u16(base + i),
        bytes: Array.from(buf.slice(i, i + 16)),
      })
    }
    return list
  }, [buf, base])

  const isHighlight = (addr: number) =>
    highlightAddrs?.some((a) => u16(a) === u16(addr))

  return (
    <SectionCard title="Working memory" className="flex-2">
      <div className="h-full overflow-auto">
        <div className="sticky top-0 z-10 border-b- border-zinc-800 py-2 flex items-center gap-2">
          <span className="opacity-70">Memory @</span>
          <input
            className="bg-tranparent border border-zinc-800 rounded px-2 py-1 w-28"
            defaultValue={fmt16(base)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = parseInt(
                  e.currentTarget.value.replace(/^0x/i, ''),
                  16
                )
                if (!Number.isNaN(v)) onJump(u16(v))
              }
            }}
          />
        </div>
        {rows.map((r) => (
          <div
            key={r.addr}
            className="grid grid-cols-[6rem_1fr] py-1 border-b border-zinc-900"
          >
            <div className="opacity-60">{fmt16(r.addr)}</div>
            <div className="flex gap-2">
              <div className="flex gap-1 w-[520px]">
                {r.bytes.map((b, i) => {
                  const a = u16(r.addr + i)
                  return (
                    <span
                      key={i}
                      className={`w-6 inline-block text-center ${isHighlight(a) ? 'bg-amber-500/20 rounded' : ''}`}
                    >
                      {fmt8(b, true)}
                    </span>
                  )
                })}
              </div>
              <div className="opacity-60">
                {String.fromCharCode(
                  ...r.bytes.map((b) => (b >= 32 && b <= 126 ? b : 46))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
