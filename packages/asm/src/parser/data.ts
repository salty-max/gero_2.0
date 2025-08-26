import * as P from 'parsil'

import {
  commaSeparated,
  exportMarker,
  hexLiteralCore,
  HSPACE,
  O_HSPACE,
  validIdentifier,
} from './common'
import { type AsmError, AsmErrors, toAsm } from './errors'
import { asData, type AsmParser, type DataNode } from './types'

const dataCore = (size: 8 | 16) =>
  P.coroutine((run) => {
    const isExport = Boolean(run(exportMarker))

    run(P.str(`data${size}`))
    run(HSPACE)

    const name = run(validIdentifier)

    run(P.between(HSPACE, HSPACE)(P.char('=')))
    run(P.char('{'))
    run(O_HSPACE)

    const values = run(commaSeparated(hexLiteralCore))

    run(O_HSPACE)
    run(P.char('}'))
    run(O_HSPACE)

    return { size, name, isExport, values }
  })
    .withSpan()
    .map(({ value, start, end }) => asData({ ...value, loc: { start, end } }))

const data8Core = dataCore(8)
const data16Core = dataCore(16)

const mapDataError =
  (size: 8 | 16) =>
  ({ index, error }: { index: number; error: unknown }) => {
    const msg = String((error as AsmError).message ?? error)
    let message = `Invalid data${size} declaration. Expected: data${size} <name> = { $.., $.. }`

    if (/char: Expected '='/.test(msg)) {
      message = 'Expected "=" between data name and initializer'
    } else if (/char: Expected '\{\'/.test(msg)) {
      message = 'Expected "{" to start data initializer list'
    } else if (/char: Expected '\}'/.test(msg)) {
      message = 'Expected "}" to end data initializer list'
    } else if (/manyOne: Expected to match at least one value/.test(msg)) {
      message =
        'Invalid hex literal in data list (need at least one hex digit after "$")'
    }

    return { code: AsmErrors.E_DATA, message, index }
  }

export const data8: AsmParser<DataNode> = toAsm(
  data8Core,
  AsmErrors.E_DATA
).errorMap(mapDataError(8))

export const data16: AsmParser<DataNode> = toAsm(
  data16Core,
  AsmErrors.E_DATA
).errorMap(mapDataError(16))
