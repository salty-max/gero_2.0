import * as P from 'parsil'
import { O_HSPACE, validIdentifier } from './common'
import { asCast, type AsmParser, type CastNode } from './types'
import { AsmErrors, toAsm } from './errors'

const castCore = P.coroutine<CastNode>((run) => {
  // <Type>
  try {
    run(P.char('<'))
  } catch {
    run(P.fail('Expected "<" to start cast type'))
  }

  let structure = ''
  try {
    run(validIdentifier.lookahead())
  } catch {
    run(P.fail('Invalid cast type (expected identifier inside "<>")'))
  }
  structure = run(validIdentifier)

  try {
    run(P.char('>'))
  } catch {
    run(P.fail('Expected ">" to end cast type'))
  }

  run(O_HSPACE)

  // symbol
  let symbol = ''
  try {
    run(validIdentifier.lookahead())
  } catch {
    run(P.fail('Invalid symbol name after cast type'))
  }
  symbol = run(validIdentifier)

  // '.'
  try {
    run(P.char('.'))
  } catch {
    run(P.fail('Expected "." between symbol and property'))
  }

  // property
  let property = ''
  try {
    run(validIdentifier.lookahead())
  } catch {
    run(P.fail('Invalid property name after "."'))
  }
  property = run(validIdentifier)

  run(O_HSPACE)

  return asCast({ structure, symbol, property })
})

export const cast: AsmParser<CastNode> = toAsm(castCore, AsmErrors.E_CAST)
export { castCore }
