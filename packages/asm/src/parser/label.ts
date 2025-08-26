import * as P from 'parsil'

import { O_HSPACE, validIdentifier } from './common'
import { AsmErrors, toAsm } from './errors'
import { asLabel, type AsmParser, type LabelNode } from './types'

export const label: AsmParser<LabelNode> = toAsm(
  P.coroutine((run) => {
    run(O_HSPACE)

    const named = run(validIdentifier.withSpan())

    run(O_HSPACE)
    run(P.char(':'))
    run(O_HSPACE)

    return asLabel(named.value, { start: named.start, end: named.end })
  }),
  AsmErrors.E_LABEL
).errorMap(({ index, error }) => {
  return {
    code: AsmErrors.E_LABEL,
    message: /char: Expected ':'/.test(error.message)
      ? 'Expected ":" after label name'
      : 'Invalid label name',
    index,
  }
})
