import type { OpcodeName } from '@gero/vm/instructions'
import type { RegName } from '@gero/vm/register'
import * as P from 'parsil'

import type { AsmError } from './errors'

export type AsmParser<T> = P.Parser<T, AsmError>

export type Nested<T> = (T | Nested<T>)[]

export type Span = { start: number; end: number }

export type OperatorNode =
  | { type: 'PLUS'; value: '+' }
  | { type: 'MINUS'; value: '-' }
  | { type: 'FACTOR'; value: '*' }

export type RegNode = {
  type: 'REGISTER'
  value: RegName
  loc: Span
}

export type RegPtrNode = {
  type: 'REGISTER_PTR'
  value: RegName
  loc: Span
}

export type HexNode = {
  type: 'HEX_LITERAL'
  value: number
  raw: string
  loc: Span
}

export type AddrLitNode = {
  type: 'ADDR_LITERAL'
  value: number
  raw: string
  loc: Span
}

export type VarNode = {
  type: 'VARIABLE'
  value: string
  loc: Span
}

export type CastNode = {
  type: 'CAST'
  structure: string
  symbol: string
  property: string
  loc: Span
}

export type ValueNode = HexNode | VarNode

export type BinaryOpNode = {
  type: 'BINARY_OP'
  lhs: ExprNode
  rhs: ExprNode
  op: OperatorNode
  loc: Span
}

export type ExprNode = ValueNode | GroupNode | BinaryOpNode | CastNode

export type AddressNode = {
  type: 'ADDRESS'
  expr: AddrLitNode | ValueNode | BinaryOpNode
  loc: Span
}

export type ArgNode =
  | RegNode
  | RegPtrNode
  | AddressNode
  | AddrLitNode
  | ExprNode

export type LabelNode = {
  type: 'LABEL'
  value: string
  loc: Span
}

export type DataNode = {
  type: 'DATA'
  size: 8 | 16
  name: string
  isExport: boolean
  values: HexNode[]
  loc: Span
}

export type ConstantNode = {
  type: 'CONSTANT'
  name: string
  isExport: boolean
  value: HexNode
  loc: Span
}

export type StructNode = {
  type: 'STRUCT'
  name: string
  isExport: boolean
  members: { key: string; value: HexNode }[]
  loc: Span
}

export type InstructionNode = {
  type: 'INSTRUCTION'
  opcode: OpcodeName
  args: ArgNode[]
  loc: Span
}

export type SqBrExprNode = {
  type: 'SQUARE_BRACKET_EXPR'
  expr: ExprToken[]
  loc: Span
}

export type ParenExprNode = {
  type: 'PAREN_EXPR'
  expr: ExprToken[]
  loc: Span
}

export type GroupNode = SqBrExprNode | ParenExprNode

export type ExprToken = ExprNode | OperatorNode

export const asOpPlus = (value: '+'): OperatorNode => ({
  type: 'PLUS',
  value,
})

export const asOpMinus = (value: '-'): OperatorNode => ({
  type: 'MINUS',
  value,
})

export const asOpFactor = (value: '*'): OperatorNode => ({
  type: 'FACTOR',
  value,
})

export const asRegister = (value: RegName, loc: Span): RegNode => ({
  type: 'REGISTER',
  value,
  loc,
})

export const asRegisterPtr = (value: RegName, loc: Span): RegPtrNode => ({
  type: 'REGISTER_PTR',
  value,
  loc,
})

export const asHexLiteral = (raw: string, loc: Span): HexNode => ({
  type: 'HEX_LITERAL',
  value: parseInt(raw, 16),
  raw,
  loc,
})

export const asAddrLiteral = (raw: string, loc: Span): AddrLitNode => ({
  type: 'ADDR_LITERAL',
  value: parseInt(raw, 16),
  raw,
  loc,
})

export const asVariable = (value: string, loc: Span): VarNode => ({
  type: 'VARIABLE',
  value,
  loc,
})

export const asCast = (args: Omit<CastNode, 'type'>): CastNode => ({
  type: 'CAST',
  ...args,
})

export const asSquareBracketExpr = (
  expr: ExprToken[],
  loc: Span
): SqBrExprNode => ({
  type: 'SQUARE_BRACKET_EXPR',
  expr,
  loc,
})

export const asParenExpr = (expr: ExprToken[], loc: Span): ParenExprNode => ({
  type: 'PAREN_EXPR',
  expr,
  loc,
})

export const asBinaryOp = (
  args: Omit<BinaryOpNode, 'type' | 'loc'>
): BinaryOpNode => {
  const start = Math.min(args.lhs.loc.start, args.rhs.loc.start)
  const end = Math.max(args.lhs.loc.end, args.rhs.loc.end)
  return { type: 'BINARY_OP', ...args, loc: { start, end } }
}

export const asAddrExprNode = (
  expr: AddrLitNode | ValueNode | BinaryOpNode,
  loc: Span
): AddressNode => ({
  type: 'ADDRESS',
  expr,
  loc,
})

export const asInstruction = ({
  opcode,
  args,
  loc,
}: {
  opcode: OpcodeName
  args: ArgNode[]
  loc: Span
}): InstructionNode => ({
  type: 'INSTRUCTION',
  opcode,
  args,
  loc,
})

export const asLabel = (value: string, loc: Span): LabelNode => ({
  type: 'LABEL',
  value,
  loc,
})

export const asData = (args: Omit<DataNode, 'type'>): DataNode => ({
  type: 'DATA',
  ...args,
})

export const asConstant = (args: Omit<ConstantNode, 'type'>): ConstantNode => ({
  type: 'CONSTANT',
  ...args,
})

export const asStruct = (args: Omit<StructNode, 'type'>): StructNode => ({
  type: 'STRUCT',
  ...args,
})

// helpers referenced by group.ts
export const isOperator = (tok: unknown): tok is OperatorNode => {
  if (!tok || typeof tok !== 'object') return false
  const type = (tok as { type?: unknown }).type
  return type === 'PLUS' || type === 'MINUS' || type === 'FACTOR'
}
export const typeParenExpr = (
  expr: Nested<ExprToken>,
  loc?: Span
): ParenExprNode => ({
  type: 'PAREN_EXPR',
  expr: expr as ExprToken[],
  loc: loc ?? { start: 0, end: 0 },
})
