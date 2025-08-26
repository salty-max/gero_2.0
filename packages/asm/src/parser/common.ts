import type { OpcodeKeyword } from '@gero/vm/instructions'
import { REGISTER_NAMES, type RegName } from '@gero/vm/register'
import * as P from 'parsil'

import { AsmErrors, toAsm } from './errors'
import { squareBracketCore } from './group'
import {
  type AddressNode,
  type AddrLitNode,
  asAddrExprNode,
  asAddrLiteral,
  asHexLiteral,
  type AsmParser,
  asOpFactor,
  asOpMinus,
  asOpPlus,
  asRegister,
  asRegisterPtr,
  asVariable,
  type BinaryOpNode,
  type HexNode,
  type OperatorNode,
  type RegNode,
  type RegPtrNode,
  type ValueNode,
  type VarNode,
} from './types'

const isWord = (ch: string) => /[A-Za-z0-9_]/.test(ch)

export const HSPACE = P.regex(/^[ \t]*/)
export const O_HSPACE = P.possibly(HSPACE)
export const NL = P.regex(/^\r?\n/)

// Comment from ';' to end of line (not including trailing newline)
const REST_NO_NL = P.regex(/^[^\r\n]*/)
export const COMMENT = P.char(';')
  .chain(() => REST_NO_NL)
  .map(() => null)

// End of line: optional spaces, optional comment, then newline
export const EOL = toAsm(
  P.sequenceOf([O_HSPACE, P.possibly(COMMENT), NL]).map(() => null),
  AsmErrors.E_EOL
)

// Line end or EOF: optional spaces, optional comment, then NL or EOF
export const LINE_END = toAsm(
  P.choice([
    EOL,
    P.sequenceOf([O_HSPACE, P.possibly(COMMENT), P.endOfInput]).map(() => null),
  ]).map(() => null),
  AsmErrors.E_EOL
)

export const upperOrLowerStr = (s: string) =>
  P.choice([P.str(s.toUpperCase()), P.str(s.toLowerCase())])

export const mapJoin = (parser: P.Parser<string[]>) =>
  parser.map((items) => items.join(''))

export const validIdentifier = mapJoin(
  P.sequenceOf([
    P.regex(/^[a-zA-Z_]/),
    P.possibly(P.regex(/^[a-zA-Z0-9_]+/)).map((x) => (x === null ? '' : x)),
  ])
)

export const keyword = (k: OpcodeKeyword): AsmParser<OpcodeKeyword> =>
  toAsm(
    P.coroutine((run) => {
      run(upperOrLowerStr(k))
      const peek = run(P.peek)
      if (peek !== -1) {
        const ch = String.fromCharCode(peek)
        if (isWord(ch)) {
          run(P.fail(`expected boundary after "${k}"`))
        }
      }
      return k
    }),
    AsmErrors.E_MNEMONIC
  )

export const separatorCore = P.between(O_HSPACE, O_HSPACE)(P.char(','))

export const separator: AsmParser<unknown> = toAsm(
  separatorCore,
  AsmErrors.E_SEP
).errorMap(({ index }) => ({
  code: AsmErrors.E_SEP,
  message: 'Expected "," between operands',
  index,
}))

export function commaSeparated<T>(p: P.Parser<T>): P.Parser<T[]> {
  return P.sepBy<unknown, T, string>(separatorCore)(p)
}

const registerCore = P.choice(REGISTER_NAMES.map(upperOrLowerStr))

export const register: AsmParser<RegNode> = toAsm(
  P.coroutine((run) => {
    const reg = run(registerCore.withSpan())
    run(O_HSPACE)

    return asRegister(reg.value as RegName, { start: reg.start, end: reg.end })
  }),
  AsmErrors.E_REG
).errorMap(({ index }) => ({
  code: AsmErrors.E_REG,
  message: 'Unknown register',
  index,
}))

export const registerPtr: AsmParser<RegPtrNode> = toAsm(
  P.sequenceOf([P.char('&'), registerCore])
    .spanMap(([, name], loc) => asRegisterPtr(name as RegName, loc))
    .skip(O_HSPACE),
  AsmErrors.E_REGPTR
).errorMap(({ index }) => ({
  code: AsmErrors.E_REGPTR,
  message: 'Expected register after "&" (e.g. &r1)',
  index,
}))

const hexDigit = P.regex(/^[0-9A-Fa-f]/)

const hexDigits = mapJoin(P.manyOne(hexDigit)).errorMap(
  () => 'Invalid hex literal (expected at least one hex digit after "$"'
)

export const hexLiteralCore: P.Parser<HexNode> = P.char('$')
  .then(hexDigits)
  .spanMap((raw, loc) => asHexLiteral(raw, loc))

export const variableCore: P.Parser<VarNode> = P.char('!')
  .then(validIdentifier)
  .spanMap((name, loc) => asVariable(name, loc))
  .errorMap(() => 'Invalid variable name after "!"')

export const operatorCore: P.Parser<OperatorNode> = P.choice([
  P.char('+').spanMap((v, loc) => asOpPlus(v as '+', loc)),
  P.char('-').spanMap((v, loc) => asOpMinus(v as '-', loc)),
  P.char('*').spanMap((v, loc) => asOpFactor(v as '*', loc)),
]).errorMap(() => 'Expected operator (+, -, *)')

export const hexLiteral: AsmParser<HexNode> = toAsm(
  hexLiteralCore,
  AsmErrors.E_HEX
).errorMap(({ error, index }) => ({
  code: AsmErrors.E_HEX,
  message: error.message,
  index,
}))

export const variable: AsmParser<VarNode> = toAsm(
  variableCore,
  AsmErrors.E_VAR
).errorMap(({ error, index }) => ({
  code: AsmErrors.E_VAR,
  message: error.message,
  index,
}))

export const operator: AsmParser<OperatorNode> = toAsm(
  operatorCore,
  AsmErrors.E_OPERATOR
).errorMap(({ error, index }) => ({
  code: AsmErrors.E_OPERATOR,
  message: error.message,
  index,
}))

const addrHex = mapJoin(P.manyOne(hexDigit)).spanMap((raw, loc) =>
  asAddrLiteral(raw, loc)
)

export const addrExpr: AsmParser<AddressNode> = toAsm(
  P.coroutine<AddrLitNode | ValueNode | BinaryOpNode>((run) => {
    run(P.char('&'))
    const next = run(P.peek)
    if (next === -1) run(P.fail('Address must be a hex literal or &[...]'))
    const ch = String.fromCharCode(next)
    if (ch === '[') return run(squareBracketCore)
    if (/[0-9A-Fa-f]/.test(ch)) return run(addrHex)
    run(P.fail('Address must be a hex literal or &[...] (try "&[!label]")'))
    // Unreachable, but satisfy the type system
    return run(addrHex)
  })
    .withSpan()
    .map(({ value, start, end }) => asAddrExprNode(value, { start, end })),
  AsmErrors.E_ADDR
)

export const exportMarker = P.possibly(P.char('+'))
