import * as P from 'parsil'
import type { AsmParser } from './types'

export enum AsmErrors {
  E_PARSE,
  E_MNEMONIC,
  E_BAD_OPERANDS,
  E_BAD_ARG,
  E_ADDR,
  E_PAREN,
  E_EOL,
  E_SEP,
  E_REG,
  E_REGPTR,
  E_HEX,
  E_VAR,
  E_OPERATOR,
  E_IMM,
  E_LABEL,
  E_GROUP,
  E_CONST,
  E_DATA,
}

export interface AsmError {
  code: AsmErrors
  message: string
  index: number
}

function isAsmError(x: unknown): x is AsmError {
  return (
    !!x &&
    typeof x === 'object' &&
    'code' in x &&
    'message' in x &&
    'index' in x
  )
}

function coerceMsg(e: unknown): string {
  if (typeof e === 'string') return e
  if (
    e &&
    typeof e === 'object' &&
    'message' in e &&
    typeof (e as any).message === 'string'
  ) {
    return (e as any).message
  }
  return String(e)
}

export const toAsm = <T, E>(
  p: P.Parser<T, E>,
  code: AsmError['code'] = AsmErrors.E_PARSE
): AsmParser<T> =>
  p.errorMap(({ error, index }) => {
    if (isAsmError(error)) return error // pass through structured errors
    return { code, message: coerceMsg(error), index }
  })

export const bubbleOr = <T>(
  p: P.Parser<T, any>,
  or: (msg: string, index: number) => AsmError
): P.Parser<T, AsmError> =>
  p.errorMap(({ error, index }) => {
    if (isAsmError(error)) return error // preserve structured child errors
    return or(coerceMsg(error), index) // synthesize otherwise
  })

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function formatAsmError(src: string, err: AsmError): string {
  const i = clamp(err.index ?? 0, 0, src.length)

  // compute 1-based line/col
  let line = 1
  for (let k = 0; k < i; k++) if (src.charCodeAt(k) === 10 /* \n */) line++

  const lineStart = src.lastIndexOf('\n', Math.max(0, i - 1)) + 1
  const nextNL = src.indexOf('\n', i)
  const lineEnd = nextNL === -1 ? src.length : nextNL
  const col = i - lineStart + 1

  const lineText = src.slice(lineStart, lineEnd)
  const caret = ' '.repeat(Math.max(0, col - 1)) + '^'

  return [
    err.message,
    `line ${line}, column ${col}`,
    `${String(line).padStart(2, ' ')} | ${lineText}`,
    `   | ${caret}`,
  ].join('\n')
}

export function parseOrReport<T>(
  parser: AsmParser<T>,
  input: string
): { ok: true; result: T } | { ok: false; message: string } {
  const res = parser.run(input)
  if (!res.isError) return { ok: true, result: res.result }
  return { ok: false, message: formatAsmError(input, res.error) }
}

export function parseOrExit<T>(parser: AsmParser<T>, input: string): T | never {
  const r = parseOrReport(parser, input)
  if (r.ok) return r.result
  console.error(r.message)
  process.exit(1)
}
