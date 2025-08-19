import * as P from 'parsil'
import { asLabel, type AsmParser, type LabelNode } from './types'
import { AsmErrors, toAsm } from './errors'
import { HSPACE, validIdentifier } from './common'

export const label: AsmParser<LabelNode> = toAsm(
  P.coroutine((run) => {
    run(P.possibly(HSPACE))
    const name = run(validIdentifier)
    run(P.char(':'))
    run(P.possibly(HSPACE))
    return asLabel(name)
  }),
  AsmErrors.E_LABEL
).errorMap(({ index, error }) => ({
  code: AsmErrors.E_LABEL,
  message:
    typeof error === 'string' && /char: Expected ':'/.test(error)
      ? 'Expected ":" after label name'
      : 'Invalid label',
  index,
}))

