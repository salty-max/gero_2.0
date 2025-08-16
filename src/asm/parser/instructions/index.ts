import * as P from 'parsil'
import {
  OpcodeForm,
  OPCODES_TABLE,
  type OpcodeKeyword,
  type OpcodeMeta,
  type OpcodeName,
} from '../../../vm/instructions'

import {
  addrExpr,
  eol,
  hexLiteral,
  register,
  registerPtr,
  separator,
  variable,
} from '../common'
import { squareBracketExpr } from '../group'
import { asInstruction, type ArgNode, type InstructionNode } from '../types'

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

const imm = P.choice([hexLiteral, variable, squareBracketExpr])

const argsOf = (parsers: P.Parser<ArgNode>[]): P.Parser<ArgNode[]> =>
  P.coroutine((run) => {
    if (parsers.length === 0) {
      return []
    }
    const [first, ...rest] = parsers
    const args: ArgNode[] = [run(first!)]
    for (const p of rest) {
      run(separator)
      args.push(run(p))
    }
    return args
  })

const FORM_ARGS_ONLY: Record<OpcodeForm, () => P.Parser<ArgNode[]>> = {
  [OpcodeForm.NO_ARGS]: () => argsOf([]),
  [OpcodeForm.SINGLE_IMM]: () => argsOf([imm]),
  [OpcodeForm.SINGLE_REG]: () => argsOf([register]),
  [OpcodeForm.SINGLE_MEM]: () => argsOf([addrExpr]),
  [OpcodeForm.IMM_REG]: () => argsOf([imm, register]),
  [OpcodeForm.REG_IMM]: () => argsOf([register, imm]),
  [OpcodeForm.REG_REG]: () => argsOf([register, register]),
  [OpcodeForm.REG_MEM]: () => argsOf([register, addrExpr]),
  [OpcodeForm.MEM_REG]: () => argsOf([addrExpr, register]),
  [OpcodeForm.IMM_MEM]: () => argsOf([imm, addrExpr]),
  [OpcodeForm.IMM8_MEM]: () => argsOf([imm, addrExpr]),
  [OpcodeForm.REG_PTR_REG]: () => argsOf([registerPtr, register]),
  [OpcodeForm.IMM_OFF_REG]: () => argsOf([imm, register, register]),
}

const IDENT = P.regex(/^[A-Za-z][A-Za-z0-9_]*/)

const instruction = P.coroutine((run) => {
  run(P.optionalWhitespace)

  const word = run(IDENT)
  const lower = word.toLowerCase() as OpcodeKeyword

  if (!BY_KEYWORD.has(lower)) {
    run(P.fail(`Unknown mnemonic "${word}"`))
  }

  run(P.optionalWhitespace)

  const variants = BY_KEYWORD.get(lower)!
    .sort((a, b) => (FORM_PRIORITY[b.form] ?? 0) - (FORM_PRIORITY[a.form] ?? 0))
    .map((meta) =>
      FORM_ARGS_ONLY[meta.form]().map<InstructionNode>((args) =>
        asInstruction({ opcode: meta.name as OpcodeName, args })
      )
    )

  const node = run(
    P.choice(variants).errorMap(() => `Invalid operands for "${word}"`)
  )

  run(P.optionalWhitespace)
  return node
})

export default instruction
