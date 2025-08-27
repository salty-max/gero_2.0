import { useVM } from '@/contexts/vm-context'
import { SectionCard } from '../section-card'
import { useCallback, useEffect, useRef, useState } from 'react'
import { disassemble, fromBytes } from '@gero/disasm'
import type { DisasmNode, RegionHint, Span } from '@gero/disasm'
import { fmt8, fmt16 } from '@gero/util'
import { ChevronLeftIcon, FlagTriangleRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type React from 'react'
import { ScrollArea } from '../ui/scroll-area'
import { useProgram } from '@/contexts/program-context'
import { AssemblyOptions } from '../assembly-options'

/* ----------------------------- Row model ----------------------------- */

type Row =
  | {
      kind: 'code'
      addr: number
      bytes: number[]
      node: DisasmNode
      isCurrentIP: boolean
    }
  | {
      kind: 'incomplete'
      addr: number
      bytes: number[]
      reason?: string
      isCurrentIP: boolean
    }
  | {
      kind: 'table'
      addr: number
      bytes: number[]
      elemSize: 1 | 2
      values: number[]
    }
  | { kind: 'u8'; addr: number; bytes: number[]; value: number }
  | { kind: 'u16'; addr: number; bytes: number[]; value: number }

/* ----------------------------- Helpers ----------------------------- */

function formatArgNode(arg: DisasmNode['args'][0]): string {
  switch (arg.kind) {
    case 'reg':
      return arg.name
    case 'regPtr':
      return `&${arg.name}`
    case 'imm8':
      return fmt8(arg.value)
    case 'imm16':
      return fmt16(arg.value)
    case 'addr':
      return `&${fmt16(arg.value)}`
    case 'immOffReg':
      return `${fmt8(arg.imm)}[${arg.regName}]`
  }
}

function formatInstruction(node: DisasmNode): string {
  const args = node.args.map(formatArgNode).join(', ')
  return args ? `${node.name} ${args}` : node.name
}

function formatBytes(bytes: number[]): string {
  return bytes.map((b) => fmt8(b)).join(' ')
}

function spanToRow(span: Span, currentIP: number): Row | null {
  switch (span.kind) {
    case 'code':
      return {
        kind: 'code',
        addr: span.addr,
        bytes: span.bytes,
        node: span.node,
        isCurrentIP: span.addr === currentIP,
      }
    case 'incomplete':
      return {
        kind: 'incomplete',
        addr: span.addr,
        bytes: span.bytes,
        reason: span.reason,
        isCurrentIP: span.addr === currentIP,
      }
    case 'table8':
      return {
        kind: 'table',
        addr: span.addr,
        bytes: span.values,
        elemSize: 1,
        values: span.values,
      }
    case 'table16':
      return {
        kind: 'table',
        addr: span.addr,
        bytes: span.values,
        elemSize: 2,
        values: span.values,
      }
    case 'u8':
      return {
        kind: 'u8',
        addr: span.addr,
        bytes: [span.value],
        value: span.value,
      }
    case 'u16':
      return {
        kind: 'u16',
        addr: span.addr,
        bytes: [span.value],
        value: span.value,
      }
    default:
      return null
  }
}

/* ----------------------------- UI ----------------------------- */

type AssemblyPaneProps = {
  breakpoints: number[]
  onToggleBreakpoint: (addr: number) => void
}

type InstructionRowProps = {
  row: Row
  isBreakpoint: boolean
  showBytes: boolean
  onDoubleClick?: () => void
  currentRef?: React.Ref<HTMLDivElement>
}

function InstructionRow({
  row,
  isBreakpoint,
  showBytes,
  onDoubleClick,
  currentRef,
}: InstructionRowProps) {
  const addrHex = fmt16(row.addr)
  const bytesStr = formatBytes(row.bytes)

  const isExecutableRow = row.kind === 'code' || row.kind === 'incomplete'
  const isCurrent = isExecutableRow && row.isCurrentIP

  let rightText: string
  let dim = false
  switch (row.kind) {
    case 'code':
      rightText = formatInstruction(row.node)
      break
    case 'incomplete':
      rightText = `<incomplete>${row.reason ? ' ' + row.reason : ''}`
      dim = true
      break
    case 'table':
      rightText = `TABLE${row.elemSize * 8} [${row.values
        .map((v) => (row.elemSize === 1 ? fmt8(v) : fmt16(v)))
        .join(', ')}]`
      break
    case 'u8':
      rightText = `U8 ${fmt8(row.value)}`
      break
    case 'u16':
      rightText = `U16 ${fmt16(row.value)}`
      break
  }

  return (
    <div
      ref={
        row.kind !== 'table' &&
        (row as Extract<Row, { kind: 'code' | 'incomplete' }>).isCurrentIP
          ? currentRef
          : undefined
      }
      className={cn(
        'relative grid grid-cols-[5.5rem_auto] gap-3 px-2 py-1 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm',
        isBreakpoint ? 'bg-gero/30' : '',
        dim && 'opacity-75 italic'
      )}
      title={row.kind === 'incomplete' && row.reason ? row.reason : undefined}
      onDoubleClick={onDoubleClick}
    >
      {isBreakpoint && isExecutableRow && !isCurrent && (
        <div className="absolute z-10 top-0 left-0 w-full h-full">
          <FlagTriangleRightIcon className="w-4 absolute right-1 top-1/2 -translate-y-1/2 text-gero" />
        </div>
      )}

      {isCurrent && (
        <div className="absolute z-10 inset-0 rounded border border-gero">
          <ChevronLeftIcon className="w-5 absolute right-1 top-1/2 -translate-y-1/2 text-gero" />
        </div>
      )}

      {/* Address */}
      <span
        className={cn(
          'shrink-0 tabular-nums',
          isBreakpoint ? 'text-gero' : 'opacity-60'
        )}
      >
        {addrHex}:
      </span>

      {/* Bytes + Instruction */}
      <div className="flex gap-4 items-baseline">
        <span
          className={cn(
            isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground'
          )}
        >
          {rightText}
        </span>
        {showBytes && (
          <span className="text-xs opacity-60 shrink-0">{bytesStr}</span>
        )}
      </div>
    </div>
  )
}

/* --------------------------- Component --------------------------- */

export function AssemblyPane({
  breakpoints,
  onToggleBreakpoint,
}: AssemblyPaneProps) {
  const vm = useVM()
  const program = useProgram()
  const [rows, setRows] = useState<Row[]>([])
  const [currentIP, setCurrentIP] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const STORAGE_KEY = 'gero:assembly:opts:v1'
  const [codeOnly, setCodeOnly] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const obj = JSON.parse(raw) as Record<string, unknown>
      return typeof obj.codeOnly === 'boolean' ? obj.codeOnly : false
    } catch {
      return false
    }
  })
  const [showBytes, setShowBytes] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const obj = JSON.parse(raw) as Record<string, unknown>
      return typeof obj.showBytes === 'boolean' ? obj.showBytes : false
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          codeOnly: Boolean(codeOnly),
          showBytes: Boolean(showBytes),
        })
      )
    } catch {
      // ignore
    }
  }, [codeOnly, showBytes])
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const currentRowRef = useRef<HTMLDivElement | null>(null)

  // Keep IP synced from snapshots
  useEffect(() => {
    if (vm.snap?.ip !== undefined) {
      setCurrentIP(vm.snap.ip)
    }
  }, [vm.snap?.ip])

  // Initialize IP from VM entry (on first mount / when VM becomes ready)
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (!vm.ready) return
      if (vm.snap?.ip !== undefined) {
        setCurrentIP(vm.snap.ip)
        return
      }
      try {
        const entry = await vm.getEntry()
        if (!cancelled) setCurrentIP(entry)
      } catch {
        // ignore
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [vm.ready, vm.snap?.ip, vm])

  const disassembleFromProgram = useCallback(async () => {
    const lc = program.lastCompile
    if (!lc || lc.bytes.length === 0) {
      setRows([])
      return
    }

    try {
      setError(null)

      // Use a stable base computed at load time so addresses don't drift as IP changes
      const baseAddr = program.programBase
      // Build region hints from sourceMap data entries
      const regions: RegionHint[] = (lc.sourceMap ?? [])
        .filter((e) => e.kind === 'data')
        .map((d) => {
          const start = (baseAddr + d.addr) & 0xffff
          const length = d.size
          return d.elemSize === 1
            ? ({ start, length, type: 'table8' } as const)
            : ({ start, length, type: 'table16' } as const)
        })
      const src = fromBytes(lc.bytes)
      const result = disassemble(src, {
        baseAddr,
        regions,
        codeOnly, // ← disassembler controls what comes back
        codeOnlyDiag: 'silent',
      })

      const mapped = result.spans
        .map((s) => spanToRow(s, currentIP))
        .filter((r): r is Row => r !== null)

      setRows(mapped)
    } catch (e) {
      console.error('Failed to disassemble:', e)
      setError(e instanceof Error ? e.message : 'Failed to disassemble memory')
    }
  }, [program.programBase, codeOnly, program.lastCompile, currentIP])

  useEffect(() => {
    void disassembleFromProgram()
  }, [disassembleFromProgram])

  // Auto-follow current IP in the scroll area
  useEffect(() => {
    const vp = viewportRef.current
    const el = currentRowRef.current
    if (!vp || !el) return

    const vpRect = vp.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const margin = 8
    const above = elRect.top < vpRect.top + margin
    const below = elRect.bottom > vpRect.bottom - margin
    if (above || below) {
      const offset =
        elRect.top - vpRect.top - (vp.clientHeight / 2 - el.clientHeight / 2)
      const target = vp.scrollTop + offset
      vp.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    }
  }, [currentIP, rows])

  return (
    <SectionCard
      title="Disassembly"
      className="max-h-[550px]"
      actions={
        <div className="flex items-center justify-end">
          <AssemblyOptions
            codeOnly={codeOnly}
            setCodeOnly={(v) => setCodeOnly(Boolean(v))}
            showBytes={showBytes}
            setShowBytes={(v) => setShowBytes(Boolean(v))}
          />
        </div>
      }
    >
      {error ? (
        <div className="flex items-center justify-center text-red-500 text-sm font-mono">
          Error: {error}
        </div>
      ) : (
        <ScrollArea viewportRef={viewportRef}>
          <div className="space-y-0.5 max-h-[448px]">
            {rows.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600 dark:text-gray-400 text-sm text-center py-4">
                {vm.ready ? 'No instructions to display' : 'VM not ready'}
              </div>
            ) : (
              rows.map((row) => {
                const isBp = breakpoints.includes(row.addr)
                return (
                  <InstructionRow
                    key={`${row.kind}-${row.addr}`}
                    row={row}
                    isBreakpoint={isBp}
                    showBytes={showBytes}
                    onDoubleClick={() => onToggleBreakpoint(row.addr)}
                    currentRef={currentRowRef}
                  />
                )
              })
            )}
          </div>
        </ScrollArea>
      )}
    </SectionCard>
  )
}
