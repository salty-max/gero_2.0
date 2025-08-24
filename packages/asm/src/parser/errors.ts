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
  E_STRUCT,
  E_CAST,
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
    typeof (e as AsmError).message === 'string'
  ) {
    return (e as AsmError).message
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

export const bubbleOr = <T, E>(
  p: P.Parser<T, E>,
  or: (msg: string, index: number) => AsmError
): P.Parser<T, AsmError> =>
  p.errorMap(({ error, index }) => {
    if (isAsmError(error)) return error // preserve structured child errors
    return or(coerceMsg(error), index) // synthesize otherwise
  })

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function expandTabs(s: string, tabWidth = 8): string {
  let out = ''
  let col = 0
  for (let c = 0; c < s.length; c++) {
    const ch = s[c]
    if (ch === '\t') {
      const spaces = tabWidth - (col % tabWidth)
      out += ' '.repeat(spaces)
      col += spaces
    } else {
      out += ch
      // NOTE: treat each code unit as width 1 for simplicity.
      // This keeps behavior predictable in ASCII; wide glyphs are rare in source.
      col += 1
    }
  }
  return out
}

function visualWidth(s: string, tabWidth = 8): number {
  let col = 0
  for (let c = 0; c < s.length; c++) {
    const ch = s[c]
    if (ch === '\t') {
      col += tabWidth - (col % tabWidth)
    } else {
      col += 1
    }
  }
  return col
}

function formatAsmError(src: string, err: AsmError): string {
  const i = clamp(err.index ?? 0, 0, src.length)

  // compute 1-based line/col (logical col from raw characters)
  let line = 1
  for (let k = 0; k < i; k++) if (src.charCodeAt(k) === 10 /* \n */) line++

  const lineStart = src.lastIndexOf('\n', Math.max(0, i - 1)) + 1
  const nextNL = src.indexOf('\n', i)
  const lineEnd = nextNL === -1 ? src.length : nextNL

  // Raw line (strip any CR to avoid console carriage return quirks)
  const rawLine = src.slice(lineStart, lineEnd).replace(/\r/g, '')

  // Compute visual caret position accounting for tabs
  const prefixRaw = src.slice(lineStart, i).replace(/\r/g, '')
  const caretSpaces = visualWidth(prefixRaw)
  const displayCol = caretSpaces + 1

  const lineText = expandTabs(rawLine)
  const caret = ' '.repeat(Math.max(0, caretSpaces)) + '^'

  return [
    err.message,
    `line ${line}, column ${displayCol}`,
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
