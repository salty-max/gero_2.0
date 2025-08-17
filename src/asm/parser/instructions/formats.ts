import * as P from 'parsil'
import {
  addrExpr,
  hexLiteral,
  keyword,
  mnemonic,
  register,
  registerPtr,
  separator,
  variable,
} from '../common'
import { asInstruction, type ArgNode, type InstructionNode } from '../types'
import { squareBracketExpr } from '../group'
import type { OpcodeKeyword, OpcodeName } from '../../../vm/instructions'

export type FormatParser = (
  keyword: OpcodeKeyword,
  type: OpcodeName
) => P.Parser<InstructionNode>

export type NonEmpty<T> = readonly [T, ...T[]]

const imm = P.choice([hexLiteral, variable, squareBracketExpr])

const withArgs = (
  k: OpcodeKeyword,
  op: OpcodeName,
  argParsers: NonEmpty<P.Parser<ArgNode>>
): P.Parser<InstructionNode> =>
  P.coroutine((run) => {
    run(keyword(k))

    const [first, ...rest] = argParsers
    const args: ArgNode[] = [run(first)]

    for (const p of rest) {
      run(separator)
      args.push(run(p))
    }

    run(P.optionalWhitespace)

    return asInstruction({ opcode: op, args })
  })

export const noArgs: FormatParser = (k, op) =>
  P.coroutine((run) => {
    run(mnemonic(k))
    run(P.optionalWhitespace)

    const b = run(P.peek)
    if (b !== -1) {
      if (b !== 10 && b !== 13) {
        run(P.fail(`${k} does not take arguments`))
      }
    }

    return asInstruction({ opcode: op, args: [] })
  })

const singleImm: FormatParser = (k, op) => withArgs(k, op, [imm])
const singleReg: FormatParser = (k, op) => withArgs(k, op, [register])
const singleMem: FormatParser = (k, op) => withArgs(k, op, [addrExpr])
const immReg: FormatParser = (k, op) => withArgs(k, op, [imm, register])
const regReg: FormatParser = (k, op) => withArgs(k, op, [register, register])
const regMem: FormatParser = (k, op) => withArgs(k, op, [register, addrExpr])
const regImm: FormatParser = (k, op) => withArgs(k, op, [register, imm])
const memReg: FormatParser = (k, op) => withArgs(k, op, [addrExpr, register])
const immMem: FormatParser = (k, op) => withArgs(k, op, [imm, addrExpr])
const imm8Mem: FormatParser = (k, op) => withArgs(k, op, [imm, addrExpr])
const regPtrReg: FormatParser = (k, op) =>
  withArgs(k, op, [registerPtr, register])
const immOffReg: FormatParser = (k, op) =>
  withArgs(k, op, [imm, register, register])

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
