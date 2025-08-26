import { squareBracketExpr } from '@gero/asm/parser/group'
import { describe, expect, it } from 'bun:test'

import { BIN, FACTOR, HEX, MINUS, PLUS, VAR } from './factory'
import { runOk } from './helpers'

describe('Parser ▸ Groups and Precedence', () => {
  it('folds simple [] to single value', () => {
    const g = runOk(squareBracketExpr, '[$02 + $03]')
    expect(g).toMatchObject(BIN(HEX('02'), PLUS, HEX('03')))
  })

  it('* before + inside []', () => {
    const g = runOk(squareBracketExpr, '[$02 + $03 * $04]')
    expect(g).toMatchObject(
      BIN(HEX('02'), PLUS, BIN(HEX('03'), FACTOR, HEX('04')))
    )
  })

  it('+ and - are same precedence, left-assoc', () => {
    const g = runOk(squareBracketExpr, '[$10 - $03 - $02]')
    expect(g).toMatchObject(
      BIN(BIN(HEX('10'), MINUS, HEX('03')), MINUS, HEX('02'))
    )
  })

  it('both sides have mul terms', () => {
    const g = runOk(squareBracketExpr, '[$02 * $03 + $04 * $05]')
    expect(g).toMatchObject(
      BIN(
        BIN(HEX('02'), FACTOR, HEX('03')),
        PLUS,
        BIN(HEX('04'), FACTOR, HEX('05'))
      )
    )
  })

  it('parens override precedence', () => {
    const g = runOk(squareBracketExpr, '[$02 * ($03 + $04)]')
    expect(g).toMatchObject(
      BIN(HEX('02'), FACTOR, BIN(HEX('03'), PLUS, HEX('04')))
    )
  })

  it('nested parens (deep)', () => {
    const g = runOk(squareBracketExpr, '[($01 + ($02 + $03)) * ($04 - $05)]')
    expect(g).toMatchObject(
      BIN(
        BIN(HEX('01'), PLUS, BIN(HEX('02'), PLUS, HEX('03'))),
        FACTOR,
        BIN(HEX('04'), MINUS, HEX('05'))
      )
    )
  })

  it('variables mix with literals', () => {
    const g = runOk(squareBracketExpr, '[$02 + !x * $03]')
    expect(g).toMatchObject(
      BIN(HEX('02'), PLUS, BIN(VAR('x'), FACTOR, HEX('03')))
    )
  })

  it('variables inside parens', () => {
    const g = runOk(squareBracketExpr, '[($02 + !x) * $03]')
    expect(g).toMatchObject(
      BIN(BIN(HEX('02'), PLUS, VAR('x')), FACTOR, HEX('03'))
    )
  })

  it('allows space at edges and single spaces between tokens', () => {
    const g = runOk(squareBracketExpr, '[ $02 + $03 * $04 ]')
    expect(g).toMatchObject(
      BIN(HEX('02'), PLUS, BIN(HEX('03'), FACTOR, HEX('04')))
    )
  })

  it('errors on multiple spaces between tokens', () => {
    expect(() => runOk(squareBracketExpr, '[  $02  +   $03 *  $04 ]')).toThrow(
      /single space/i
    )
  })

  // ——— error cases ———

  it('errors: empty group', () => {
    expect(() => runOk(squareBracketExpr, '[]')).toThrow(
      /Empty group|Expected value/i
    )
  })

  it('errors: starts with operator', () => {
    expect(() => runOk(squareBracketExpr, '[+ $02]')).toThrow(/Expected value/i)
  })

  it('errors: ends with operator', () => {
    expect(() => runOk(squareBracketExpr, '[$02 + ]')).toThrow(
      /right-hand value|Trailing tokens/i
    )
  })

  it('errors: double operator', () => {
    expect(() => runOk(squareBracketExpr, '[$02 + * $03]')).toThrow(
      /Expected value|operator/i
    )
  })
})
