import type { OpcodeName, RegName } from '@gero/vm'
import type { DisasmError } from './errors'

export type Span =
  | {
      kind: 'code'
      addr: number
      size: number
      bytes: number[]
      node: DisasmNode
    }
  | { kind: 'u8'; addr: number; size: 1; value: number }
  | { kind: 'u16'; addr: number; size: 2; value: number }
  | { kind: 'table8'; addr: number; size: number; values: number[] }
  | { kind: 'table16'; addr: number; size: number; values: number[] }

export type RegionType = 'code' | 'u8' | 'u16' | 'table8' | 'table16'

export type RegionHint = {
  start: number
  length: number
  type: RegionType
  label?: string
}

export type ArgNode =
  | { kind: 'reg'; index: number; name: RegName }
  | { kind: 'regPtr'; index: number; name: RegName }
  | { kind: 'imm8'; value: number }
  | { kind: 'imm16'; value: number }
  | { kind: 'addr'; value: number }
  | { kind: 'immOffReg'; imm: number; regIndex: number; regName: RegName }

export type DisasmNode = {
  addr: number
  size: number
  bytes: number[]
  opcode: number
  name: OpcodeName
  args: ArgNode[]
  error?: string
}

export type SymbolResolver = (addr: number) => string | undefined

export type DisasmOptions = {
  baseAddr?: number
  maxBytes?: number
  maxInstrs?: number
  regions?: RegionHint[]
  strict?: boolean
  codeOnly?: boolean
  codeOnlyDiag?: 'silent' | 'aggregate' | 'verbose'
}

export type DisasmResult = {
  start: number
  end: number
  spans: Span[]
  diags: DisasmDiags
}

export type DisasmDiags = {
  errors: DisasmError[]
  skipped?: Array<{ start: number; end: number; count: number }>
}
