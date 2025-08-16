import {
  type HexNode,
  type VarNode,
  type OpPlusNode,
  type OpMinusNode,
  type OpFactorNode,
  type OperatorNode,
  type OperandNode,
  type BinaryOpNode,
  type SqBrExprNode,
  type ParenExprNode,
  type InstructionNode,
  type ArgNode,
} from '../../src/asm/parser/types'
import type { OpcodeName } from '../../src/vm/instructions'
import type { RegName } from '../../src/vm/register'

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

export const ADDR_SQ = (node: any) =>
  ({ type: 'ADDRESS', expr: SQ1(node) }) as const

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

export const PLUS: OpPlusNode = { type: 'PLUS', value: '+' }
export const MINUS: OpMinusNode = { type: 'MINUS', value: '-' }
export const FACTOR: OpFactorNode = { type: 'FACTOR', value: '*' }

export const BIN = (
  a: OperandNode,
  op: OperatorNode,
  b: OperandNode
): BinaryOpNode => ({
  type: 'BINARY_OP',
  a,
  op,
  b,
})

export const SQ1 = (n: OperandNode): SqBrExprNode => ({
  type: 'SQUARE_BRACKET_EXPR',
  expr: [n],
})

export const PAR1 = (n: OperandNode): ParenExprNode => ({
  type: 'PAREN_EXPR',
  expr: [n],
})
