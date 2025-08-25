import * as P from 'parsil'

import { exportMarker, LINE_END, O_HSPACE } from './common'
import { constant } from './constant'
import { data8, data16 } from './data'
import { type AsmError, toAsm } from './errors'
import instruction from './instructions'
import { label } from './label'
import { struct } from './struct'
import type { ProgramNode } from './types'

const kw = (s: string) =>
  toAsm(P.sequenceOf([exportMarker, O_HSPACE, P.str(s)]).lookahead())

const labelLook = toAsm(
  P.sequenceOf([
    O_HSPACE,
    P.regex(/^[A-Za-z0-9_]+/),
    O_HSPACE,
    P.char(':'),
  ]).lookahead()
)

const parser = P.coroutine<ProgramNode[], AsmError>((run) => {
  const nodes: ProgramNode[] = []

  while (true) {
    // EOF
    try {
      run(toAsm(P.endOfInput.lookahead()))
      break
    } catch {}

    // blank line or comment-only line (with or without trailing newline)
    try {
      run(toAsm(LINE_END))
      continue
    } catch {}

    // constants: handle "+ const"; if lookahead matches, bubble errors from parser
    {
      let looksLikeConst = true
      try {
        run(kw('const'))
      } catch {
        looksLikeConst = false
      }
      if (looksLikeConst) {
        nodes.push(run(constant))
        continue
      }
    }

    // structs: handle "+ struct"; if lookahead matches, bubble errors from parser
    {
      let looksLikeStruct = true
      try {
        run(kw('struct'))
      } catch {
        looksLikeStruct = false
      }
      if (looksLikeStruct) {
        nodes.push(run(struct))
        continue
      }
    }

    // data: handle "+ data8" / "+ data16"
    {
      let looksLikeData8 = true
      try {
        run(kw('data8'))
      } catch {
        looksLikeData8 = false
      }
      if (looksLikeData8) {
        nodes.push(run(data8))
        continue
      }
    }
    {
      let looksLikeData16 = true
      try {
        run(kw('data16'))
      } catch {
        looksLikeData16 = false
      }
      if (looksLikeData16) {
        nodes.push(run(data16))
        continue
      }
    }

    // label (don’t fully parse here; just check the shape)
    // If the lookahead matches, parse the label and allow any label error
    // to bubble so tests see the intended "Invalid label" messages.
    {
      let looksLikeLabel = true
      try {
        run(labelLook)
      } catch {
        looksLikeLabel = false
      }
      if (looksLikeLabel) {
        nodes.push(run(label))
        continue
      }
    }

    // instruction (fallback)
    nodes.push(run(instruction))
  }

  return nodes
})

export default parser
