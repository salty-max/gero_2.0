import * as P from 'parsil'
import type { InstructionNode } from '../types'
import {
  OpcodeForm,
  OPCODES_TABLE,
  type OpcodeKeyword,
  type OpcodeMeta,
} from '../../../vm/instructions'
import formats, { type FormatParser } from './formats'
import { HSPACE } from '../common'

const FORM_PRIORITY: Partial<Record<OpcodeForm, number>> = {
  [OpcodeForm.REG_PTR_REG]: 90,
  [OpcodeForm.IMM_OFF_REG]: 85,
  [OpcodeForm.REG_MEM]: 80,
  [OpcodeForm.MEM_REG]: 79,
  [OpcodeForm.IMM_MEM]: 75,
  [OpcodeForm.IMM8_MEM]: 74,
  [OpcodeForm.REG_REG]: 60,
  [OpcodeForm.IMM_REG]: 55,
  [OpcodeForm.REG_IMM]: 54,
  [OpcodeForm.SINGLE_MEM]: 40,
  [OpcodeForm.SINGLE_REG]: 39,
  [OpcodeForm.SINGLE_IMM]: 38,
  [OpcodeForm.NO_ARGS]: 10,
}

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
metas.sort(
  (a, b) =>
    a.keyword.localeCompare(b.keyword) ||
    (FORM_PRIORITY[b.form] ?? 0) - (FORM_PRIORITY[a.form] ?? 0)
)

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

const PAREN_IMM_MSG =
  'Parenthesized expressions are not allowed as a top-level immediate.\n' +
  'Use hex like `$CAFE` or `[ ... ]`:\n' +
  '  mov $CAFE, r3\n' +
  '  mov [$CA-01 + $00FE], r4'

const AMP_PAREN_MSG =
  'Use square brackets for addresses: `&[ ... ]`, not `&(...)`.'

const instruction: P.Parser<InstructionNode> = P.coroutine((run) => {
  run(P.possibly(HSPACE))

  const word = run(IDENT.lookahead())
  const lower = word.toLowerCase() as OpcodeKeyword

  if (!BY_KEYWORD.has(lower)) {
    run(P.fail(`Unknown mnemonic "${word}"`))
  }

  const tail = run(REST_OF_LINE.lookahead())
  const paren = classifyTopLevelParen(tail)
  if (paren) {
    run(
      P.fail(
        paren.kind === 'parenAfterAmpersand' ? AMP_PAREN_MSG : PAREN_IMM_MSG
      )
    )
  }

  // Build variant parsers for this mnemonic using your dedicated format parsers
  const metas = BY_KEYWORD.get(lower)!.sort(
    (a, b) => (FORM_PRIORITY[b.form] ?? 0) - (FORM_PRIORITY[a.form] ?? 0)
  )

  const variants = metas.map((meta) => {
    const pf = BY_FORM[meta.form]
    return pf(meta)
  })

  const node = run(
    P.choice(variants).errorMap((err) => {
      const meta = metas.find((m) => m.keyword === lower)
      const msg = String((err as any).error ?? err)
      // Only replace the aggregate “no variant matched” error
      return msg.includes('choice: Unable to match with any parser')
        ? `Invalid operands for ${meta?.name}`
        : ((err as any).error ?? msg) // keep specific inner messages (like imm’s)
    })
  )

  return node
})

export default instruction
