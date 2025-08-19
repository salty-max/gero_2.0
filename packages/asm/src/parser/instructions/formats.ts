import * as P from 'parsil'
import {
  addrExpr,
  HSPACE,
  keyword,
  register,
  registerPtr,
  separator,
  upperOrLowerStr,
  EOL,
  hexLiteral,
  variable,
} from '../common'
import {
  asInstruction,
  type ArgNode,
  type AsmParser,
  type BinaryOpNode,
  type HexNode,
  type InstructionNode,
  type ValueNode,
} from '../types'
import type {
  OpcodeKeyword,
  OpcodeMeta,
  OpcodeName,
} from '@gero/vm/instructions'
import { AsmErrors, bubbleOr, toAsm, type AsmError } from '../errors'
import { squareBracketExpr } from '../group'

export type FormatParser = (meta: OpcodeMeta) => AsmParser<InstructionNode>

// Thunk the argument parsers to avoid touching imported bindings at module init.
type ArgThunk = () => AsmParser<ArgNode>
type NonEmptyThunks = readonly [ArgThunk, ...ArgThunk[]]

export const imm: AsmParser<HexNode | ValueNode | BinaryOpNode> = toAsm(
  P.choice([hexLiteral, variable, squareBracketExpr]),
  AsmErrors.E_IMM
).errorMap(({ index }) => ({
  code: AsmErrors.E_IMM,
  message:
    'Invalid immediate: expected hex like "$ABCD", a variable like "!x", or a [ ... ] expression',
  index,
}))

const withArgs = (
  meta: OpcodeMeta,
  argThunks: NonEmptyThunks
): AsmParser<InstructionNode> =>
  P.coroutine<InstructionNode, AsmError>((run) => {
    // boundary-aware mnemonic
    run(keyword(meta.keyword as OpcodeKeyword))
    // require at least one space before args
    run(toAsm(HSPACE))

    const wrapArg = (
      i: number,
      p: P.Parser<ArgNode, string | AsmError>
    ): AsmParser<ArgNode> =>
      bubbleOr(p, (_, index) => ({
        code: AsmErrors.E_BAD_ARG,
        message: `Invalid arg #${i} for ${meta.name}`,
        index,
      }))

    const [firstThunk, ...restThunks] = argThunks

    // evaluate thunks lazily **here** (parse time, not module init)
    const args: ArgNode[] = [run(wrapArg(1, firstThunk()))]

    for (let i = 0; i < restThunks.length; i++) {
      run(toAsm(separator))
      args.push(run(wrapArg(i + 2, restThunks[i]!())))
    }

    run(toAsm(P.possibly(HSPACE)))
    return asInstruction({ opcode: meta.name as OpcodeName, args })
  })

export const noArgs: FormatParser = (meta) =>
  P.coroutine<InstructionNode, AsmError>((run) => {
    // boundary-aware keyword
    run(toAsm(upperOrLowerStr(meta.keyword as OpcodeKeyword)))
    // tolerate spaces after mnemonic
    run(toAsm(P.possibly(HSPACE)))

    // allow only EOL/EOF afterwards (lookahead so multi-line parsing keeps working)
    const endGuard = P.choice([
      toAsm(P.endOfInput.lookahead()),
      toAsm(EOL.lookahead()),
    ])
    try {
      run(endGuard)
    } catch {
      run(
        toAsm(
          P.fail(`${meta.name} does not take any arguments`),
          AsmErrors.E_BAD_ARG
        )
      )
    }

    return asInstruction({ opcode: meta.name as OpcodeName, args: [] })
  })

// Use thunks everywhere so nothing touches imported parsers during module init.
const singleImm: FormatParser = (m) => withArgs(m, [() => imm])
const singleReg: FormatParser = (m) => withArgs(m, [() => register])
const singleMem: FormatParser = (m) => withArgs(m, [() => addrExpr])
const immReg: FormatParser = (m) => withArgs(m, [() => imm, () => register])
const regReg: FormatParser = (m) =>
  withArgs(m, [() => register, () => register])
const regMem: FormatParser = (m) =>
  withArgs(m, [() => register, () => addrExpr])
const regImm: FormatParser = (m) => withArgs(m, [() => register, () => imm])
const memReg: FormatParser = (m) =>
  withArgs(m, [() => addrExpr, () => register])
const immMem: FormatParser = (m) => withArgs(m, [() => imm, () => addrExpr])
const imm8Mem: FormatParser = (m) => withArgs(m, [() => imm, () => addrExpr])
const regPtrReg: FormatParser = (m) =>
  withArgs(m, [() => registerPtr, () => register])
const immOffReg: FormatParser = (m) =>
  withArgs(m, [() => imm, () => register, () => register])

export default {
  noArgs,
  singleImm,
  singleReg,
  singleMem,
  immReg,
  regReg,
  regMem,
  regImm,
  memReg,
  immMem,
  imm8Mem,
  regPtrReg,
  immOffReg,
}

