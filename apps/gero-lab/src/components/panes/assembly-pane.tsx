import { useVM } from '@/contexts/vm-context'
import { SectionCard } from '../section-card'
import { useCallback, useEffect, useState } from 'react'
import { disassemble, fromBytes } from '@gero/disasm'
import type { DisasmNode, Span } from '@gero/disasm'
import { fmt8, fmt16 } from '@gero/util'
import { ChevronLeftIcon, FlagTriangleRightIcon } from 'lucide-react'
import { cn, toU16 } from '@/lib/utils'

type AssemblyPaneProps = {
  breakpoints: number[]
  onToggleBreakpoint: (addr: number) => void
}

type InstructionDisplay = {
  addr: string
  bytes: string
  instruction: string
  isCurrentIP?: boolean
  incomplete?: boolean
  reason?: string
}

function formatArgNode(arg: DisasmNode['args'][0]): string {
  switch (arg.kind) {
    case 'reg':
      return arg.name
    case 'regPtr':
      return `[${arg.name}]`
    case 'imm8':
      return `${fmt8(arg.value)}`
    case 'imm16':
      return `${fmt16(arg.value)}`
    case 'addr':
      return `&${fmt16(arg.value)}`
    case 'immOffReg':
      return `${fmt8(arg.imm)}[${arg.regName}]`
    default:
      return '?'
  }
}

function formatInstruction(node: DisasmNode): string {
  const args = node.args.map(formatArgNode).join(', ')
  return args ? `${node.name} ${args}` : node.name
}

function formatBytes(bytes: number[]): string {
  return bytes.map((b) => fmt8(b)).join(' ')
}

export function AssemblyPane({
  breakpoints,
  onToggleBreakpoint,
}: AssemblyPaneProps) {
  const vm = useVM()
  const [instructions, setInstructions] = useState<InstructionDisplay[]>([])
  const [currentIP, setCurrentIP] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  // Update current IP when snapshot changes
  useEffect(() => {
    if (vm.snap?.ip !== undefined) {
      setCurrentIP(vm.snap.ip)
    }
  }, [vm.snap?.ip])

  // Disassemble memory around current IP
  const disassembleMemory = useCallback(async () => {
    if (!vm.ready || currentIP === undefined) return

    try {
      setError(null)

      // Read memory around current IP (e.g., 64 bytes before and after)
      const baseAddr = Math.max(0, currentIP - 64)
      const length = 128

      const memoryData = await vm.peek(baseAddr, length)

      // Disassemble the memory
      const result = disassemble(fromBytes(memoryData), {
        baseAddr,
        maxInstrs: 20,
        codeOnly: true,
        codeOnlyDiag: 'silent',
      })

      // Convert spans to display format
      const displayInstructions: InstructionDisplay[] = result.spans
        .filter(
          (span): span is Extract<Span, { kind: 'code' | 'incomplete' }> =>
            span.kind === 'code' || span.kind === 'incomplete'
        )
        .map((span) => {
          if (span.kind === 'code') {
            return {
              addr: fmt16(span.addr),
              bytes: formatBytes(span.bytes),
              instruction: formatInstruction(span.node),
              isCurrentIP: span.addr === currentIP,
            }
          }
          // incomplete span
          return {
            addr: fmt16(span.addr),
            bytes: formatBytes(span.bytes) + ' …',
            instruction: `<incomplete>${span.reason ? ' ' + span.reason : ''}`,
            isCurrentIP: span.addr === currentIP,
            incomplete: true,
            reason: span.reason,
          }
        })

      setInstructions(displayInstructions)
    } catch (err) {
      console.error('Failed to disassemble:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to disassemble memory'
      )
    }
  }, [vm, currentIP])

  useEffect(() => {
    disassembleMemory()
  }, [disassembleMemory])

  if (error) {
    return (
      <SectionCard title="Assembly code">
        <div className="flex items-center justify-center text-red-500 text-sm font-mono">
          Error: {error}
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Assembly code">
      <div className="space-y-0.5 max-h-full overflow-y-auto">
        {instructions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 dark:text-gray-400 text-sm text-center py-4">
            {vm.ready ? 'No instructions to display' : 'VM not ready'}
          </div>
        ) : (
          instructions.map((ins) => {
            const addrNum = toU16(ins.addr)
            const isBp = breakpoints.includes(addrNum)
            return (
              <InstructionRow
                key={ins.addr}
                ins={ins}
                isBreakpoint={isBp}
                onDoubleClick={() => onToggleBreakpoint(addrNum)}
              />
            )
          })
        )}
      </div>
    </SectionCard>
  )
}

type InstructionRowProps = {
  ins: InstructionDisplay
  isBreakpoint?: boolean
  onDoubleClick?: () => void
}

function InstructionRow({
  ins,
  isBreakpoint,
  onDoubleClick,
}: InstructionRowProps) {
  return (
    <div
      className={cn(
        'relative flex gap-4 px-2 py-1 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm',
        isBreakpoint ? 'bg-gero/30' : '',
        ins.incomplete ? 'opacity-75 italic' : ''
      )}
      title={ins.incomplete && ins.reason ? ins.reason : undefined}
      onDoubleClick={onDoubleClick}
    >
      {isBreakpoint && !ins.isCurrentIP && (
        <div className={cn('absolute z-10 top-0 left-0 w-full h-full')}>
          <FlagTriangleRightIcon className="w-4 absolute right-1 top-1/2 -translate-y-1/2 text-gero" />
        </div>
      )}
      {ins.isCurrentIP && (
        <div
          className={cn(
            'absolute z-10 top-0 left-0 w-full h-full rounded border border-gero'
          )}
        >
          <ChevronLeftIcon className="w-5 absolute right-1 top-1/2 -translate-y-1/2 text-gero" />
        </div>
      )}
      <span
        className={cn('shrink-0', isBreakpoint ? 'text-gero' : 'opacity-60')}
      >
        {ins.addr}:
      </span>

      <span
        className={cn(
          ins.isCurrentIP
            ? 'text-primary font-semibold'
            : 'text-gray-900 dark:text-gray-100'
        )}
      >
        {ins.instruction}
      </span>
    </div>
  )
}
