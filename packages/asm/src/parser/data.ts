import * as P from 'parsil'
import {
  HSPACE,
  validIdentifier,
  exportMarker,
  hexLiteralCore,
  commaSeparated,
} from './common'
import { asData, type AsmParser, type DataNode } from './types'
import { toAsm, AsmErrors } from './errors'

const dataCore = (size: 8 | 16) =>
  P.coroutine((run) => {
    const isExport = Boolean(run(exportMarker))

    run(P.str(`data${size}`))
    run(HSPACE)

    const name = run(validIdentifier)

    run(P.between(HSPACE, HSPACE)(P.char('=')))
    run(P.char('{'))
    run(P.possibly(HSPACE))

    const values = run(commaSeparated(hexLiteralCore))

    run(P.possibly(HSPACE))
    run(P.char('}'))
    run(P.possibly(HSPACE))

    return asData({ size, name, isExport, values })
  })

const data8Core = dataCore(8)
const data16Core = dataCore(16)

const mapDataError =
  (size: 8 | 16) =>
  ({ index, error }: { index: number; error: unknown }) => {
    const msg = String((error as any)?.error ?? error)
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

