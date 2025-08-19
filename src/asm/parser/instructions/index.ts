import * as P from 'parsil'
import type { AsmParser, InstructionNode } from '../types'
import {
  OpcodeForm,
  OPCODES_TABLE,
  type OpcodeKeyword,
  type OpcodeMeta,
} from '../../../vm/instructions'
import formats, { type FormatParser } from './formats'
import { HSPACE } from '../common'
import { AsmErrors, toAsm, type AsmError } from '../errors'

const IDENT = P.regex(/^[A-Za-z][A-Za-z0-9_]*/)

const BY_FORM: Record<OpcodeForm, FormatParser> = {
  [OpcodeForm.NO_ARGS]: formats.noArgs,
  [OpcodeForm.SINGLE_IMM]: formats.singleImm,
  [OpcodeForm.SINGLE_REG]: formats.singleReg,
  [OpcodeForm.SINGLE_MEM]: formats.singleMem,
  [OpcodeForm.IMM_REG]: formats.immReg,
  [OpcodeForm.REG_REG]: formats.regReg,
  [OpcodeForm.REG_MEM]: formats.regMem,
  [OpcodeForm.REG_IMM]: formats.regImm,
  [OpcodeForm.MEM_REG]: formats.memReg,
  [OpcodeForm.IMM_MEM]: formats.immMem,
  [OpcodeForm.IMM8_MEM]: formats.imm8Mem,
  [OpcodeForm.REG_PTR_REG]: formats.regPtrReg,
  [OpcodeForm.IMM_OFF_REG]: formats.immOffReg,
}

const metas = [...(Object.values(OPCODES_TABLE) as OpcodeMeta[])]
const BY_KEYWORD = new Map<OpcodeKeyword, OpcodeMeta[]>()
for (const m of metas) {
  const list = BY_KEYWORD.get(m.keyword as OpcodeKeyword) ?? []
  list.push(m)
  BY_KEYWORD.set(m.keyword as OpcodeKeyword, list)
}

// anchored (Parsil expects '^')
const REST_OF_LINE = P.regex(/^[^\r\n]*/)

/** Find the first '(' at top level (not inside [ ... ]) and classify it. */
function classifyTopLevelParen(
  s: string
): { kind: 'parenImmediate' } | { kind: 'parenAfterAmpersand' } | null {
  let bracketDepth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '[') {
      bracketDepth++
      continue
    }
    if (c === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1)
      continue
    }
    if (c !== '(' || bracketDepth > 0) continue

    // find previous non-space/tab char
    let j = i - 1
    while (j >= 0 && (s[j] === ' ' || s[j] === '\t')) j--
    if (j >= 0 && s[j] === '&') return { kind: 'parenAfterAmpersand' }
    return { kind: 'parenImmediate' }
  }
  return null
}

function isGenericMsg(msg: string): boolean {
  return /^(Invalid arg #\d+ for |Invalid operands for )/.test(msg)
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

/** Count commas at top level (outside [] or ()) until EOL */
function countTopLevelCommas(s: string): number {
  let depth = 0
  let n = 0
  for (const c of s) {
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth = Math.max(0, depth - 1)
    else if (c === ',' && depth === 0) n++
    else if (c === '\r' || c === '\n') break
  }
  return n
}

/** Prefer forms based on the very first non-space char of the operand list */
function preferForm(form: OpcodeForm, firstCh: string): boolean {
  if (firstCh === '$' || firstCh === '!' || firstCh === '[') {
    // immediates and bracketed expressions
    return (
      form === OpcodeForm.SINGLE_IMM ||
      form === OpcodeForm.IMM_REG ||
      form === OpcodeForm.IMM_MEM ||
      form === OpcodeForm.IMM8_MEM ||
      form === OpcodeForm.IMM_OFF_REG
    )
  }
  if (firstCh === '&') {
    // could be memory (&XXXX or &[...]) or register pointer (&r1)
    return (
      form === OpcodeForm.SINGLE_MEM ||
      form === OpcodeForm.MEM_REG ||
      form === OpcodeForm.IMM_MEM ||
      form === OpcodeForm.IMM8_MEM ||
      form === OpcodeForm.REG_PTR_REG // <- ensure &r1, r2 is preferred
    )
  }
  if (/[A-Za-z]/.test(firstCh)) {
    // register start
    return (
      form === OpcodeForm.SINGLE_REG ||
      form === OpcodeForm.REG_REG ||
      form === OpcodeForm.REG_MEM ||
      form === OpcodeForm.REG_IMM ||
      form === OpcodeForm.REG_PTR_REG
    )
  }
  return false
}

/**
 * Try multiple variants:
 * - Probe all with lookahead to collect the farthest index + most specific message.
 * - If none matches, re-run the best variant (not in lookahead) so its structured error bubbles
 *   with the correct index, rather than synthesizing a generic error at the current index.
 */

function chooseWithBestError<T>(
  variants: AsmParser<T>[],
  fallbackMsg: string
): AsmParser<T> {
  return P.coroutine<T, AsmError>((run) => {
    let bestIdx = -1
    let bestSpecificity = -1
    let bestMsg = fallbackMsg
    let bestVariantIdx = -1

    const probes = variants.map((v, vi) =>
      v.lookahead().errorMap(({ error, index }) => {
        const msg = isAsmError(error) ? error.message : coerceMsg(error)
        const spec = isGenericMsg(msg) ? 0 : 1

        if (index > bestIdx || (index === bestIdx && spec > bestSpecificity)) {
          bestIdx = index
          bestSpecificity = spec
          bestMsg = msg
          bestVariantIdx = vi
        }

        return isAsmError(error) ? error : msg
      })
    )

    try {
      run(toAsm(P.choice(probes)))
    } catch {
      if (bestVariantIdx >= 0 && bestVariantIdx < variants.length) {
        const bestVariant: AsmParser<T> = variants[bestVariantIdx]!
        run(bestVariant) // bubble its structured error
      }
      run(toAsm(P.fail(bestMsg), AsmErrors.E_BAD_OPERANDS))
    }

    return run(P.choice(variants))
  })
}

const PAREN_IMM_MSG =
  'Parenthesized expressions are not allowed as a top-level immediate.\n' +
  'Use hex like `$CAFE` or `[ ... ]`:\n' +
  '  mov $CAFE, r3\n' +
  '  mov [$CA-01 + $00FE], r4'

const AMP_PAREN_MSG =
  'Use square brackets for addresses: `&[ ... ]`, not `&(...)`.'

const instruction: AsmParser<InstructionNode> = P.coroutine<
  InstructionNode,
  AsmError
>((run) => {
  run(toAsm(P.possibly(HSPACE)))

  const word = run(toAsm(IDENT.lookahead()))
  const lower = word.toLowerCase() as OpcodeKeyword

  if (!BY_KEYWORD.has(lower)) {
    run(toAsm(P.fail(`Unknown mnemonic "${word}"`), AsmErrors.E_MNEMONIC))
  }

  const tail = run(toAsm(REST_OF_LINE.lookahead()))

  // nice top-level paren diagnostics
  const paren = classifyTopLevelParen(tail)
  if (paren) {
    const isAddr = paren.kind === 'parenAfterAmpersand'
    run(
      toAsm(
        P.fail(isAddr ? AMP_PAREN_MSG : PAREN_IMM_MSG),
        isAddr ? AsmErrors.E_ADDR : AsmErrors.E_PAREN
      )
    )
  }

  // heuristics: arity + first-operand classifier
  const afterMnemonic = tail.slice(word.length)
  const rest = afterMnemonic.replace(/^[ \t]*/, '')
  const firstCh = rest[0] ?? ''

  // optional arity filter
  const commas = countTopLevelCommas(rest)
  // if there are any non-space tokens, args = commas + 1, else 0
  const hasAnything = rest.length > 0 && !/^\r|\n/.test(rest[0] ?? '')
  const expectedArgs = hasAnything ? commas + 1 : 0

  let ops = BY_KEYWORD.get(lower)!.slice()

  // if schema exists on the meta, use it to filter by arity
  if ('schema' in ops[0]!) {
    ops = ops.filter((m) => (m as any).schema?.length === expectedArgs)
    if (ops.length === 0) {
      // keep all forms if arity filter would eliminate everything; we'll fall back to errors
      ops = BY_KEYWORD.get(lower)!.slice()
    }
  }

  // reorder by preference based on first token
  const preferred: OpcodeMeta[] = []
  const others: OpcodeMeta[] = []
  for (const m of ops)
    (preferForm(m.form, firstCh) ? preferred : others).push(m)
  const ordered = [...preferred, ...others]

  const variants = ordered.map((meta) => BY_FORM[meta.form](meta))

  const node = run(
    chooseWithBestError(
      variants,
      `Invalid operands for ${ordered.find((m) => m.keyword === lower)?.name}`
    )
  )

  return node
})

export default instruction
