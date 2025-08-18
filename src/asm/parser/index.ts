import * as P from 'parsil'
import instruction from './instructions'
import type { InstructionNode, LabelNode } from './types'
import { EOL, label } from './common'

const parser = P.coroutine((run) => {
  const nodes: Array<InstructionNode | LabelNode> = []

  while (true) {
    try {
      run(P.endOfInput.lookahead())
      break
    } catch {}

    try {
      run(EOL)
      continue
    } catch {}

    try {
      run(label.lookahead())
      nodes.push(run(label))
    } catch {
      nodes.push(run(instruction))
    }
  }

  return nodes
})
export default parser
