import * as P from 'parsil'
import {
  exportMarker,
  HSPACE,
  validIdentifier,
  separatorCore,
  hexLiteralCore,
} from './common'
import {
  asStruct,
  type AsmParser,
  type StructNode,
  type HexNode,
} from './types'
import { AsmErrors, toAsm } from './errors'

const keyValuePair = P.coroutine<{ key: string; value: HexNode }>((run) => {
  run(P.optionalWhitespace)

  try {
    run(validIdentifier.lookahead())
  } catch {
    run(P.fail('Invalid field name'))
  }
  const key = run(validIdentifier)

  run(P.optionalWhitespace)
  try {
    run(P.char(':'))
  } catch {
    run(P.fail('Expected ":" after field name'))
  }
  run(P.optionalWhitespace)

  const value = run(hexLiteralCore)
  run(P.optionalWhitespace)

  return { key, value }
})

const structCore = P.coroutine<StructNode>((run) => {
  const isExport = Boolean(run(exportMarker))

  run(P.str('struct'))
  run(HSPACE)

  try {
    run(validIdentifier.lookahead())
  } catch {
    run(P.fail('Invalid identifier'))
  }
  const name = run(validIdentifier)

  run(P.optionalWhitespace)
  try {
    run(P.char('{'))
  } catch {
    run(P.fail('Expected "{" to start struct body'))
  }
  run(P.optionalWhitespace)

  const members: { key: string; value: HexNode }[] = []
  if (String.fromCharCode(run(P.peek)) !== '}') {
    members.push(run(keyValuePair))
    while (true) {
      run(P.optionalWhitespace)
      const ch = String.fromCharCode(run(P.peek))
      if (ch === '}') break
      run(separatorCore)
      // allow dangling comma: optional spaces then '}' ends list
      run(P.optionalWhitespace)
      const next = String.fromCharCode(run(P.peek))
      if (next === '}') break
      members.push(run(keyValuePair))
    }
  }

  run(P.optionalWhitespace)
  run(P.char('}'))
  run(P.optionalWhitespace)

  return asStruct({ name, members, isExport })
})

export const struct: AsmParser<StructNode> = toAsm(
  structCore,
  AsmErrors.E_STRUCT
).errorMap(({ index, error }) => {
  const msg = String((error as any)?.message ?? error)
  let message = 'Invalid struct declaration.'
  if (/Expected '\{'/i.test(msg) || /start struct body/.test(msg)) {
    message = 'Expected "{" to start struct body'
  } else if (
    /Expected '\}'/i.test(msg) ||
    /end struct body/.test(msg) ||
    /end of input/i.test(msg)
  ) {
    message = 'Expected "}" to end struct body'
  } else if (/after field name/.test(msg)) {
    message = 'Expected ":" after field name'
  } else if (/Invalid identifier/.test(msg)) {
    message = 'Invalid identifier'
  } else if (/Invalid field name/.test(msg)) {
    message = 'Invalid field name'
  } else if (/Invalid hex literal/.test(msg)) {
    message = 'Invalid hex literal (expected at least one hex digit after "$")'
  }
  return { code: AsmErrors.E_STRUCT, message, index }
})
