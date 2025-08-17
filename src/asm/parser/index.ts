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

    const node = run(P.choice([instruction, label]))
    nodes.push(node)
  }

  return nodes
})
export default parser
