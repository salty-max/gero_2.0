import * as P from 'parsil'
import type { OpcodeName } from '@gero/vm/instructions'
import type { RegName } from '@gero/vm/register'
import type { AsmError } from './errors'

export type AsmParser<T> = P.Parser<T, AsmError>

export type Nested<T> = (T | Nested<T>)[]

export type OperatorNode =
  | { type: 'PLUS'; value: '+' }
  | { type: 'MINUS'; value: '-' }
  | { type: 'FACTOR'; value: '*' }

export type RegNode = {
  type: 'REGISTER'
  value: RegName
}

export type RegPtrNode = {
  type: 'REGISTER_PTR'
  value: RegName
}

export type HexNode = {
  type: 'HEX_LITERAL'
  value: number
  raw: string
}

export type AddrLitNode = {
  type: 'ADDR_LITERAL'
  value: number
  raw: string
}

export type VarNode = {
  type: 'VARIABLE'
  value: string
}

export type ValueNode = HexNode | VarNode

export type BinaryOpNode = {
  type: 'BINARY_OP'
  a: ExprNode
  b: ExprNode
  op: OperatorNode
}

export type ExprNode = ValueNode | GroupNode | BinaryOpNode

export type AddressNode = {
  type: 'ADDRESS'
  expr: AddrLitNode | ValueNode | BinaryOpNode
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
}

export type DataNode = {
  type: 'DATA'
  size: 8 | 16
  name: string
  isExport: boolean
  values: HexNode[]
}

export type ConstantNode = {
  type: 'CONSTANT'
  name: string
  isExport: boolean
  value: HexNode
}

export type InstructionNode = {
  type: 'INSTRUCTION'
  opcode: OpcodeName
  args: ArgNode[]
}

export type SqBrExprNode = {
  type: 'SQUARE_BRACKET_EXPR'
  expr: ExprToken[]
}

export type ParenExprNode = {
  type: 'PAREN_EXPR'
  expr: ExprToken[]
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

export const asRegister = (value: RegName): RegNode => ({
  type: 'REGISTER',
  value,
})

export const asRegisterPtr = (value: RegName): RegPtrNode => ({
  type: 'REGISTER_PTR',
  value,
})

export const asHexLiteral = (raw: string): HexNode => ({
  type: 'HEX_LITERAL',
  value: parseInt(raw, 16),
  raw,
})

export const asAddrLiteral = (raw: string): AddrLitNode => ({
  type: 'ADDR_LITERAL',
  value: parseInt(raw, 16),
  raw,
})

export const asVariable = (value: string): VarNode => ({
  type: 'VARIABLE',
  value,
})

export const asSquareBracketExpr = (expr: ExprToken[]): SqBrExprNode => ({
  type: 'SQUARE_BRACKET_EXPR',
  expr,
})

export const asParenExpr = (expr: ExprToken[]): ParenExprNode => ({
  type: 'PAREN_EXPR',
  expr,
})

export const asBinaryOp = (
  a: ExprNode,
  b: ExprNode,
  op: OperatorNode
): BinaryOpNode => ({
  type: 'BINARY_OP',
  a,
  b,
  op,
})

export const asAddrExprNode = (
  expr: AddrLitNode | ValueNode | BinaryOpNode
): AddressNode => ({
  type: 'ADDRESS',
  expr,
})

export const asInstruction = ({
  opcode,
  args,
}: {
  opcode: OpcodeName
  args: ArgNode[]
}): InstructionNode => ({
  type: 'INSTRUCTION',
  opcode,
  args,
})

export const asLabel = (value: string): LabelNode => ({
  type: 'LABEL',
  value,
})

export const asData = (args: Omit<DataNode, 'type'>): DataNode => ({
  type: 'DATA',
  ...args,
})

export const asConstant = (args: Omit<ConstantNode, 'type'>): ConstantNode => ({
  type: 'CONSTANT',
  ...args,
})

// helpers referenced by group.ts
export const isOperator = (
  tok: any
): tok is OperatorNode => tok && typeof tok === 'object' && 'type' in tok &&
  (tok.type === 'PLUS' || tok.type === 'MINUS' || tok.type === 'FACTOR')
export const typeParenExpr = (expr: any): ParenExprNode => ({ type: 'PAREN_EXPR', expr })

