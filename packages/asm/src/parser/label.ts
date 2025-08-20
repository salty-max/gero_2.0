import * as P from 'parsil'
import { asLabel, type AsmParser, type LabelNode } from './types'
import { AsmErrors, toAsm } from './errors'
import { O_HSPACE, validIdentifier } from './common'

export const label: AsmParser<LabelNode> = toAsm(
  P.coroutine((run) => {
    run(O_HSPACE)

    const name = run(validIdentifier)

    run(O_HSPACE)
    run(P.char(':'))
    run(O_HSPACE)

    return asLabel(name)
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
