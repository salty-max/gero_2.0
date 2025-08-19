import * as P from 'parsil'
import {
  asHexLiteral,
  asOpFactor,
  asOpMinus,
  asOpPlus,
  asRegister,
  asVariable,
  asAddrExprNode,
  asAddrLiteral,
  asRegisterPtr,
  type AsmParser,
  type HexNode,
  type AddressNode,
  type OperatorNode,
  type VarNode,
  type RegPtrNode,
  type RegNode,
} from './types'
import { squareBracketCore } from './group'
import type { OpcodeKeyword } from '@gero/vm/instructions'
import { REGISTER_NAMES, type RegName } from '@gero/vm/register'
import { toAsm, AsmErrors } from './errors'

const isWord = (ch: string) => /[A-Za-z0-9_]/.test(ch)

export const HSPACE = P.regex(/^[ \t]*/)
export const NL = P.regex(/^\r?\n/)

export const EOL = toAsm(
  HSPACE.skip(NL).map(() => null),
  AsmErrors.E_EOL
)
export const LINE_END = P.choice([EOL, P.endOfInput])

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

export const separatorCore = P.between(
  P.possibly(HSPACE),
  P.possibly(HSPACE)
)(P.char(','))

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

export const register: AsmParser<RegNode> = toAsm(
  P.coroutine((run) => {
    const name = run(P.choice(REGISTER_NAMES.map(upperOrLowerStr)))
    run(P.possibly(HSPACE))

    return asRegister(name as RegName)
  }),
  AsmErrors.E_REG
).errorMap(({ index }) => ({
  code: AsmErrors.E_REG,
  message: 'Unknown register',
  index,
}))

export const registerPtr: AsmParser<RegPtrNode> = toAsm(
  P.coroutine((run) => {
    run(P.char('&'))
    const name = run(P.choice(REGISTER_NAMES.map(upperOrLowerStr)))
    run(P.possibly(HSPACE))
    return asRegisterPtr(name as RegName)
  }),
  AsmErrors.E_REGPTR
).errorMap(({ index }) => ({
  code: AsmErrors.E_REGPTR,
  message: 'Expected register after "&" (e.g. &r1)',
  index,
}))
const hexDigit = P.regex(/^[0-9A-Fa-f]/)

export const hexLiteralCore: P.Parser<HexNode> = P.char('$')
  .chain(() => mapJoin(P.manyOne(hexDigit)))
  .map(asHexLiteral)

export const variableCore: P.Parser<VarNode> = P.char('!')
  .chain(() => validIdentifier)
  .map(asVariable)

export const operatorCore: P.Parser<OperatorNode> = P.choice([
  P.char('+').map((v) => asOpPlus(v as '+')),
  P.char('-').map((v) => asOpMinus(v as '-')),
  P.char('*').map((v) => asOpFactor(v as '*')),
])

export const hexLiteral: AsmParser<HexNode> = toAsm(
  hexLiteralCore,
  AsmErrors.E_HEX
).errorMap(({ index }) => ({
  code: AsmErrors.E_HEX,
  message: 'Invalid hex literal (expected at least one hex digit after "$")',
  index,
}))

export const variable: AsmParser<VarNode> = toAsm(
  variableCore,
  AsmErrors.E_VAR
).errorMap(({ index }) => ({
  code: AsmErrors.E_VAR,
  message: 'Invalid variable name after "!"',
  index,
}))

export const operator: AsmParser<OperatorNode> = toAsm(
  operatorCore,
  AsmErrors.E_OPERATOR
).errorMap(({ index }) => ({
  code: AsmErrors.E_OPERATOR,
  message: 'Expected operator (+, -, *)',
  index,
}))

export const addrExpr: AsmParser<AddressNode> = toAsm(
  P.coroutine((run) => {
    run(P.char('&'))

    const next = run(P.peek)
    if (next === -1) run(P.fail('Address must be a hex literal or &[...]'))
    const ch = String.fromCharCode(next)

    if (ch === '[') {
      const group = run(squareBracketCore)
      return asAddrExprNode(group)
    }

    if (!/[0-9A-Fa-f]/.test(ch)) {
      run(P.fail('Address must be a hex literal or &[...] (try "&[!label]")'))
    }

    const raw = run(mapJoin(P.manyOne(hexDigit)))
    return asAddrExprNode(asAddrLiteral(raw))
  }),
  AsmErrors.E_ADDR
)

export const exportMarker = P.possibly(P.char('+'))

