import * as P from 'parsil'
import instruction from './instructions'
import type { InstructionNode } from './types'
import { EOL } from './common'

const parser = P.coroutine((run) => {
  const nodes: InstructionNode[] = []

  while (true) {
    try {
      run(P.endOfInput.lookahead())
      break
    } catch {}

    try {
      run(EOL)
      continue
    } catch {}

    const node = run(P.choice([instruction]))
    nodes.push(node)
  }

  return nodes
})
export default parser
