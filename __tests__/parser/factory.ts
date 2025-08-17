import {
  type HexNode,
  type VarNode,
  type OperatorNode,
  type ExprNode,
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
  a,
  op,
  b,
})

export const SQ1 = (n: ExprNode): SqBrExprNode => ({
  type: 'SQUARE_BRACKET_EXPR',
  expr: [n],
})

export const PAR1 = (n: ExprNode): ParenExprNode => ({
  type: 'PAREN_EXPR',
  expr: [n],
})
