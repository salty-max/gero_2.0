import { assemble } from '@gero/asm/assemble'
import parser from '@gero/asm/parser'
import type { AsmError } from '@gero/asm/parser/errors'
import type {
  AddressNode,
  ArgNode,
  ExprToken,
  InstructionNode,
  OperatorNode,
  ProgramNode,
} from '@gero/asm/parser/types'
import { OPCODES_TABLE } from '@gero/vm/instructions'
import { REGISTER_NAMES } from '@gero/vm/register'

type TokType =
  | 'mnemonic'
  | 'label'
  | 'register'
  | 'register-ptr'
  | 'number-hex'
  | 'addr-literal'
  | 'ident'
  | 'cast'
  | 'op-plus'
  | 'op-minus'
  | 'op-mul'
  | 'bracket'
  | 'paren'
  | 'directive'
  | 'kw-export'

export type Tok = { from: number; to: number; type: TokType }
export type LabelDef = {
  name: string
  from: number
  to: number
  line: number
  col: number
}

export type LspParseResult = {
  ast: ProgramNode[] | null
  tokens: Tok[]
  labels: LabelDef[]
  error: AsmError | null
}

export type LspAsmResult = {
  bytes: Uint8Array
  symbols: Record<string, number>
  diagnostics: {
    severity: 'error'
    message: string
    code: string | number | null
    location?: { line?: number; column?: number; offset?: number }
  }[]
  hasErrors: boolean
  canExecute: boolean
}

export function runParse(src: string): LspParseResult {
  const ast = parser.run(src)
  if (ast.isError) {
    return {
      ast: null,
      tokens: [] as Tok[],
      labels: [] as LabelDef[],
      error: ast.error,
    }
  }

  const lineStarts = buildLineStarts(src)

  return {
    ast: ast.result,
    tokens: collectTokens(ast.result, src),
    labels: collectLabelDefs(ast.result, src, lineStarts),
    error: null,
  }
}

export function runAssemble(src: string) {
  return assembleDiagnostics(src)
}

export const ISA = {
  mnemonics: OPCODES_TABLE.map((m) => m.keyword as string),
  registers: REGISTER_NAMES as readonly string[],
}

function assembleDiagnostics(src: string): LspAsmResult {
  const result = assemble(src)

  return {
    diagnostics: result.diags.errors.map((error) => ({
      severity: 'error' as const,
      message: error.message,
      code: error.code,
      location: error.location,
    })),
    symbols: result.symbols,
    bytes: new Uint8Array([...result.bytes]),
    hasErrors: result.diags.errors.length > 0,
    canExecute: result.bytes.length > 0 && result.diags.errors.length === 0,
  }
}

function collectTokens(
  nodes: ProgramNode[],
  src: string,
  out: Tok[] = []
): Tok[] {
  for (const n of nodes) {
    switch (n.type) {
      case 'INSTRUCTION':
        pushMnemonicToken(n, src, out)
        for (const a of n.args) collectArgTokens(a, src, out)
        break

      case 'LABEL':
        out.push({ from: n.loc.start, to: n.loc.end, type: 'label' })
        break

      case 'DATA':
        pushDirectiveTokens(n.loc.start, n.loc.end, src, out)
        for (const v of n.values)
          out.push({ from: v.loc.start, to: v.loc.end, type: 'number-hex' })
        break

      case 'CONSTANT':
        pushDirectiveTokens(n.loc.start, n.loc.end, src, out)
        out.push({
          from: n.value.loc.start,
          to: n.value.loc.end,
          type: 'number-hex',
        })
        break

      case 'STRUCT':
        pushDirectiveTokens(n.loc.start, n.loc.end, src, out)
        for (const m of n.members)
          out.push({
            from: m.value.loc.start,
            to: m.value.loc.end,
            type: 'number-hex',
          })
        break
    }
  }
  return out
}

function collectArgTokens(arg: ArgNode, src: string, out: Tok[]) {
  switch (arg.type) {
    case 'REGISTER':
      out.push({ from: arg.loc.start, to: arg.loc.end, type: 'register' })
      return
    case 'REGISTER_PTR':
      out.push({ from: arg.loc.start, to: arg.loc.end, type: 'register-ptr' })
      return
    case 'ADDR_LITERAL':
      out.push({ from: arg.loc.start, to: arg.loc.end, type: 'addr-literal' })
      return
    case 'HEX_LITERAL':
      out.push({ from: arg.loc.start, to: arg.loc.end, type: 'number-hex' })
      return
    case 'VARIABLE':
      out.push({ from: arg.loc.start, to: arg.loc.end, type: 'ident' })
      return
    case 'CAST':
      out.push({ from: arg.loc.start, to: arg.loc.end, type: 'cast' })
      return
    case 'ADDRESS':
      collectAddressToken(arg, src, out)
      return
    case 'BINARY_OP':
    case 'PAREN_EXPR':
    case 'SQUARE_BRACKET_EXPR':
      collectExprLikeTokens(arg, src, out)
      return
  }
}

function collectExprLikeTokens(node: ExprToken, src: string, out: Tok[]) {
  switch (node.type) {
    case 'BINARY_OP':
      collectExprLikeTokens(node.lhs, src, out)
      out.push({
        from: node.op.loc.start,
        to: node.op.loc.end,
        type: opClass(node.op),
      })
      collectExprLikeTokens(node.rhs, src, out)
      return

    case 'HEX_LITERAL':
      out.push({ from: node.loc.start, to: node.loc.end, type: 'number-hex' })
      return
    case 'VARIABLE':
      out.push({ from: node.loc.start, to: node.loc.end, type: 'ident' })
      return
    case 'CAST':
      out.push({ from: node.loc.start, to: node.loc.end, type: 'cast' })
      return

    case 'PAREN_EXPR':
      pushParenPair(node.loc.start, node.loc.end, out)
      for (const t of node.expr) collectExprToken(t, src, out)
      return

    case 'SQUARE_BRACKET_EXPR':
      pushBracketPair(node.loc.start, node.loc.end, out)
      for (const t of node.expr) collectExprToken(t, src, out)
      return
  }
}

function collectExprToken(tok: ExprToken, src: string, out: Tok[]) {
  if (tok.type === 'PLUS' || tok.type === 'MINUS' || tok.type === 'FACTOR') {
    out.push({ from: tok.loc.start, to: tok.loc.end, type: opClass(tok) })
  } else {
    collectExprLikeTokens(tok, src, out)
  }
}

function collectAddressToken(tok: AddressNode, src: string, out: Tok[]) {
  switch (tok.expr.type) {
    case 'ADDR_LITERAL':
      out.push({
        from: tok.expr.loc.start,
        to: tok.expr.loc.end,
        type: 'addr-literal',
      })
      return
    case 'HEX_LITERAL':
      out.push({
        from: tok.expr.loc.start,
        to: tok.expr.loc.end,
        type: 'number-hex',
      })
      return
    case 'VARIABLE':
      out.push({
        from: tok.expr.loc.start,
        to: tok.expr.loc.end,
        type: 'ident',
      })
      return
    case 'BINARY_OP':
      collectExprLikeTokens(tok.expr, src, out)
      return
    case 'CAST':
      out.push({ from: tok.expr.loc.start, to: tok.expr.loc.end, type: 'cast' })
      return
  }
}

function opClass(op: OperatorNode): TokType {
  switch (op.type) {
    case 'PLUS':
      return 'op-plus'
    case 'MINUS':
      return 'op-minus'
    case 'FACTOR':
      return 'op-mul'
  }
}

function pushMnemonicToken(ins: InstructionNode, src: string, out: Tok[]) {
  let i = ins.loc.start
  while (i < ins.loc.end && !isSpace(src.charCodeAt(i))) i++
  out.push({ from: ins.loc.start, to: i, type: 'mnemonic' })
}

function pushBracketPair(start: number, end: number, out: Tok[]) {
  if (end > start + 1) {
    out.push({ from: start, to: start + 1, type: 'bracket' })
    out.push({ from: end - 1, to: end, type: 'bracket' })
  }
}
function pushParenPair(start: number, end: number, out: Tok[]) {
  if (end > start + 1) {
    out.push({ from: start, to: start + 1, type: 'paren' })
    out.push({ from: end - 1, to: end, type: 'paren' })
  }
}

function pushDirectiveTokens(
  locStart: number,
  locEnd: number,
  src: string,
  out: Tok[]
) {
  let i = locStart
  // skip leading spaces in the directive span
  while (i < locEnd && isSpace(src.charCodeAt(i))) i++

  // leading '+' means "export"
  if (i < locEnd && src.charCodeAt(i) === 43 /* '+' */) {
    out.push({ from: i, to: i + 1, type: 'kw-export' })
    i += 1
    // skip spaces after '+'
    while (i < locEnd && isSpace(src.charCodeAt(i))) i++
  }

  // the directive keyword (e.g., data8, data16, constant, struct, db/dw...)
  const { start, end } = readWord(src, i, locEnd)
  if (end > start) {
    out.push({ from: start, to: end, type: 'directive' })
  }
}

function isSpace(code: number) {
  return code === 32 || code === 9
}

function collectLabelDefs(
  nodes: ProgramNode[],
  src: string,
  lineStarts: number[]
): LabelDef[] {
  const out: LabelDef[] = []
  for (const n of nodes) {
    if (n.type === 'LABEL') {
      const { line, col } = posFromIndex(lineStarts, n.loc.start)
      out.push({ name: n.value, from: n.loc.start, to: n.loc.end, line, col })
    }
  }
  return out
}

function buildLineStarts(src: string): number[] {
  const starts = [0]
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) starts.push(i + 1)
  }
  return starts
}

function posFromIndex(starts: number[], idx: number) {
  // Guarantee at least one start (buildLineStarts always supplies [0], but guard just in case)
  if (starts.length === 0) return { line: 1, col: idx + 1 }

  let lo = 0,
    hi = starts.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const startVal = starts[mid] ?? 0
    if (startVal <= idx) lo = mid + 1
    else hi = mid - 1
  }
  const lineIdx = Math.max(0, Math.min(hi, starts.length - 1))
  const lineStart = starts[lineIdx] ?? 0
  return { line: lineIdx + 1, col: idx - lineStart + 1 }
}

function isWord(code: number) {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 46 ||
    code === 95
  ) // . _
}
function readWord(src: string, from: number, limit: number) {
  let i = from
  while (i < limit && isSpace(src.charCodeAt(i))) i++
  const start = i
  while (i < limit && isWord(src.charCodeAt(i))) i++
  return { start, end: i }
}
