import * as P from 'parsil'

import {
  exportMarker,
  hexLiteralCore,
  HSPACE,
  O_HSPACE,
  validIdentifier,
} from './common'
import { AsmErrors, toAsm } from './errors'
import { asConstant, type AsmParser, type ConstantNode } from './types'

export const constant: AsmParser<ConstantNode> = toAsm(
  P.coroutine((run) => {
    const isExport = Boolean(run(exportMarker))

    run(P.str('const'))
    run(HSPACE)

    try {
      run(validIdentifier.lookahead())
    } catch {
      run(P.fail('Invalid identifier'))
    }
    const name = run(validIdentifier)

    run(P.between(O_HSPACE, O_HSPACE)(P.char('=')))

    // Require a hex literal value; give a clearer message when missing,
    // and delegate validation of digits to hexLiteral (which has its own errors)
    try {
      run(P.char('$').lookahead())
    } catch {
      run(P.fail('Expected hex literal'))
    }

    const value = run(hexLiteralCore)

    run(O_HSPACE)

    return { name, isExport, value }
  })
    .withSpan()
    .map(({ value, start, end }) =>
      asConstant({ ...value, loc: { start, end } })
    ),
  AsmErrors.E_CONST
)
