import * as P from 'parsil'
import {
  addrExpr,
  EOL,
  HSPACE,
  imm,
  keyword,
  register,
  registerPtr,
  separator,
  upperOrLowerStr,
} from '../common'
import { asInstruction, type ArgNode, type InstructionNode } from '../types'
import type {
  OpcodeKeyword,
  OpcodeMeta,
  OpcodeName,
} from '../../../vm/instructions'

export type FormatParser = (meta: OpcodeMeta) => P.Parser<InstructionNode>

export type NonEmpty<T> = readonly [T, ...T[]]

const withArgs = (
  meta: OpcodeMeta,
  argParsers: NonEmpty<P.Parser<ArgNode>>
): P.Parser<InstructionNode> =>
  P.coroutine((run) => {
    run(keyword(meta.keyword as OpcodeKeyword))

    if (argParsers.length !== meta.schema.length) {
      run(
        P.fail(
          `Wrong number of args for ${meta.name}: expected ${meta.schema.length}, but got ${argParsers.length}`
        )
      )
    }

    const [first, ...rest] = argParsers
    const args: ArgNode[] = [
      run(first.errorMap(() => `Invalid arg #1 for ${meta.name}`)),
    ]

    rest.forEach((p, i) => {
      run(separator)
      args.push(run(p.errorMap(() => `Invalid arg #${i} for ${meta.name}`)))
    })

    run(P.possibly(HSPACE))

    return asInstruction({ opcode: meta.name as OpcodeName, args })
  })

export const noArgs: FormatParser = (meta) =>
  P.coroutine((run) => {
    run(upperOrLowerStr(meta.keyword as OpcodeKeyword))
    run(P.possibly(HSPACE))
    try {
      run(P.choice([EOL, P.endOfInput]).lookahead())
    } catch {
      run(P.fail(`${meta.name} does not take any arguments`))
    }
    return asInstruction({ opcode: meta.name as OpcodeName, args: [] })
  })

const singleImm: FormatParser = (meta) => withArgs(meta, [imm])
const singleReg: FormatParser = (meta) => withArgs(meta, [register])
const singleMem: FormatParser = (meta) => withArgs(meta, [addrExpr])
const immReg: FormatParser = (meta) => withArgs(meta, [imm, register])
const regReg: FormatParser = (meta) => withArgs(meta, [register, register])
const regMem: FormatParser = (meta) => withArgs(meta, [register, addrExpr])
const regImm: FormatParser = (meta) => withArgs(meta, [register, imm])
const memReg: FormatParser = (meta) => withArgs(meta, [addrExpr, register])
const immMem: FormatParser = (meta) => withArgs(meta, [imm, addrExpr])
const imm8Mem: FormatParser = (meta) => withArgs(meta, [imm, addrExpr])
const regPtrReg: FormatParser = (meta) =>
  withArgs(meta, [registerPtr, register])
const immOffReg: FormatParser = (meta) =>
  withArgs(meta, [imm, register, register])

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
