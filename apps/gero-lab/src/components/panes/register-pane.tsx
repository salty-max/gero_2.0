import { fmt16 } from '@gero/util'
import type { RegName } from '@gero/vm'
import { useMemo, useState } from 'react'
import { SectionCard } from '../section-card'

type RegistersPaneProps = {
  regs: Record<RegName, number> | null
  onEdit: (name: RegName, value: number) => void
}

export function RegistersPane({ regs, onEdit }: RegistersPaneProps) {
  const names = useMemo(
    () => (regs ? (Object.keys(regs) as RegName[]) : []),
    [regs]
  )

  return (
    <SectionCard title="Registers">
      {regs ? (
        <div className="grid grid-cols-4 gap-2 p-3 text-sm">
          {names.map((n) => (
            <RegCell key={n} name={n} value={regs[n]!} onEdit={onEdit} />
          ))}
        </div>
      ) : (
        <div className="flex w-full h-full items-center justify-center text-sm opacity-60">
          No snapshot yet
        </div>
      )}
    </SectionCard>
  )
}

type RegCellProps = {
  name: RegName
  value: number
  onEdit: (name: RegName, value: number) => void
}

function RegCell({ name, value, onEdit }: RegCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(fmt16(value))

  return (
    <div className="border border-zinc-800 rounded px-2 py-1">
      <div className="text-xs opacity-60">{name}</div>
      {!editing ? (
        <div
          onDoubleClick={() => {
            setDraft(fmt16(value))
            setEditing(true)
          }}
        >
          {fmt16(value)}
        </div>
      ) : (
        <input
          autoFocus
          className="bg-transparent outline-none w-full"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = parseInt(draft.replace(/^0x/i, ''), 16)
              if (!Number.isNaN(v)) onEdit(name, v & 0xffff)
              setEditing(false)
            } else if (e.key === 'Escape') {
              setEditing(false)
            }
          }}
        />
      )}
    </div>
  )
}
