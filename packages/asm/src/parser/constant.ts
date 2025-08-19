import * as P from 'parsil'
import { HSPACE, validIdentifier, exportMarker, hexLiteralCore } from './common'
import { asConstant, type AsmParser, type ConstantNode } from './types'
import { toAsm, AsmErrors } from './errors'

const constantCore = P.coroutine((run) => {
  const isExport = Boolean(run(exportMarker))

  run(P.str('const'))
  run(HSPACE)

  const name = run(validIdentifier)

  run(P.between(HSPACE, HSPACE)(P.char('=')))

  const value = run(hexLiteralCore)

  run(P.possibly(HSPACE))

  return asConstant({ name, isExport, value })
})

export const constant: AsmParser<ConstantNode> = toAsm(
  constantCore,
  AsmErrors.E_CONST
).errorMap(({ index, error }) => {
  const msg = String((error as any)?.error ?? error)

  let message = 'Invalid constant declaration. Expected: const <name> = $HEX'
  if (/char: Expected '='/.test(msg)) {
    message = 'Expected "=" between constant name and value'
  } else if (/manyOne: Expected to match at least one value/.test(msg)) {
    message = 'Invalid hex literal after "=" (expected at least one hex digit)'
  } else if (/char: Expected '\$'/.test(msg)) {
    message = 'Expected hex literal after "=" (e.g. $BEEF)'
  }

  return { code: AsmErrors.E_CONST, message, index }
})
