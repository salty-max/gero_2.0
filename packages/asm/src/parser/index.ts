import * as P from 'parsil'
import instruction from './instructions'
import type {
  ConstantNode,
  DataNode,
  InstructionNode,
  LabelNode,
} from './types'
import { EOL } from './common'
import { constant } from './constant'
import { data16, data8 } from './data'
import { toAsm, type AsmError } from './errors'
import { label } from './label'

type ProgramNode = InstructionNode | LabelNode | ConstantNode | DataNode

const parser = P.coroutine<ProgramNode[], AsmError>((run) => {
  const nodes: ProgramNode[] = []

  while (true) {
    // EOF? bail.
    try {
      run(toAsm(P.endOfInput.lookahead()))
      break
    } catch {}

    // blank line? skip.
    try {
      run(toAsm(EOL))
      continue
    } catch {}

    // label
    try {
      run(label.lookahead())
      nodes.push(run(label))
      continue
    } catch {}

    // constant
    try {
      run(constant.lookahead())
      nodes.push(run(constant))
      continue
    } catch {}

    // data8
    try {
      run(data8.lookahead())
      nodes.push(run(data8))
      continue
    } catch {}

    // data16
    try {
      run(data16.lookahead())
      nodes.push(run(data16))
      continue
    } catch {}

    // instruction
    nodes.push(run(instruction))
  }

  return nodes
})

export default parser
