import {
  type ArgNode,
  type BinaryOpNode,
  type CastNode,
  type ConstantNode,
  type DataNode,
  type ExprNode,
  type HexNode,
  type InstructionNode,
  type LabelNode,
  type OperatorNode,
  type ParenExprNode,
  type SqBrExprNode,
  type StructNode,
  type VarNode,
} from '@gero/asm/parser/types'
import type { OpcodeName } from '@gero/vm/instructions'
import type { RegName } from '@gero/vm/register'

export const REG = (name: RegName) =>
  ({ type: 'REGISTER', value: name }) as const

export const REG_PTR = (name: RegName) =>
  ({ type: 'REGISTER_PTR', value: name }) as const

export const ADDR_HEX = (raw: string) =>
  ({
    type: 'ADDRESS',
    expr: {
      type: 'ADDR_LITERAL',
      raw,
      value: parseInt(raw.replace(/^\$/, ''), 16),
    },
  }) as const

export const ADDR = (node: any) => ({ type: 'ADDRESS', expr: node }) as const

export const INS = (
  opcode: OpcodeName | string,
  ...args: ArgNode[]
): InstructionNode => ({
  type: 'INSTRUCTION',
  opcode: opcode as OpcodeName,
  args,
})

export const HEX = (raw: string): HexNode => ({
  type: 'HEX_LITERAL',
  raw,
  value: parseInt(raw, 16),
})

export const VAR = (name: string): VarNode => ({
  type: 'VARIABLE',
  value: name,
})

export const PLUS: OperatorNode = { type: 'PLUS', value: '+' }
export const MINUS: OperatorNode = { type: 'MINUS', value: '-' }
export const FACTOR: OperatorNode = { type: 'FACTOR', value: '*' }

export const BIN = (
  a: ExprNode,
  op: OperatorNode,
  b: ExprNode
): BinaryOpNode => ({
  type: 'BINARY_OP',
  lhs: a,
  op,
  rhs: b,
})

export const SQ1 = (n: ExprNode): SqBrExprNode => ({
  type: 'SQUARE_BRACKET_EXPR',
  expr: [n],
})

export const PAR1 = (n: ExprNode): ParenExprNode => ({
  type: 'PAREN_EXPR',
  expr: [n],
})

export const LAB = (name: string): LabelNode => ({
  type: 'LABEL',
  value: name,
})

export const CONST = (
  name: string,
  hexRaw: string,
  isExport = false
): ConstantNode => ({
  type: 'CONSTANT',
  name,
  isExport,
  value: HEX(hexRaw),
})

const DATA = (
  size: 8 | 16,
  name: string,
  raws: string[],
  isExport = false
): DataNode => ({
  type: 'DATA',
  size,
  name,
  isExport,
  values: raws.map(HEX),
})

export const DATA8 = (name: string, raws: string[], isExport = false) =>
  DATA(8, name, raws, isExport)
export const DATA16 = (name: string, raws: string[], isExport = false) =>
  DATA(16, name, raws, isExport)

export const STRUCT = (
  name: string,
  entries: readonly [key: string, raw: string][],
  isExport = false
): StructNode => ({
  type: 'STRUCT',
  name,
  isExport,
  members: entries.map(([key, raw]) => ({ key, value: HEX(raw) })),
})

export const CAST = (
  structure: string,
  symbol: string,
  property: string
): CastNode => ({
  type: 'CAST',
  structure,
  symbol,
  property,
})
