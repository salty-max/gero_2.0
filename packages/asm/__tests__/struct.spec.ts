import parser from '@gero/asm/parser'
import { cast } from '@gero/asm/parser/cast'
import { addrExpr } from '@gero/asm/parser/common'
import { describe, expect, it } from 'bun:test'

import { CAST, STRUCT } from './factory'
import { runOk } from './helpers'

describe('Parser ▸ Structs', () => {
  it('parses struct declaration', () => {
    const ast = runOk(parser, 'struct Point { x: $0001, y: $00FF }')
    expect(ast).toMatchObject([
      STRUCT('Point', [
        ['x', '0001'],
        ['y', '00FF'],
      ]),
    ])
  })

  it('parses exported struct', () => {
    const ast = runOk(parser, '+struct Flags { a: $01 }')
    expect(ast).toMatchObject([STRUCT('Flags', [['a', '01']], true)])
  })

  it('tolerates spaces and no-spaces inside braces', () => {
    expect(runOk(parser, 'struct S{a:$AA,b:$BB}')).toMatchObject([
      STRUCT('S', [
        ['a', 'AA'],
        ['b', 'BB'],
      ]),
    ])
    expect(runOk(parser, 'struct S {  a:  $00 ,  b:  $FF  }')).toMatchObject([
      STRUCT('S', [
        ['a', '00'],
        ['b', 'FF'],
      ]),
    ])
  })

  it('allows empty struct body', () => {
    expect(runOk(parser, 'struct Empty { }')).toMatchObject([
      STRUCT('Empty', []),
    ])
  })

  it('allows trailing comma in struct body', () => {
    expect(runOk(parser, 'struct T { a: $01, b: $02, }')).toMatchObject([
      STRUCT('T', [
        ['a', '01'],
        ['b', '02'],
      ]),
    ])
  })

  it('allows trailing comma on multi-line body', () => {
    const src = ['struct Point {', '  x: $0001,', '  y: $00FF,', '}'].join('\n')
    expect(runOk(parser, src)).toMatchObject([
      STRUCT('Point', [
        ['x', '0001'],
        ['y', '00FF'],
      ]),
    ])
  })

  it('parses multi-line struct body', () => {
    const src = [
      'struct Point {',
      '  x: $0001,',
      '  y: $00FF,',
      '  z: $ABCD',
      '}',
    ].join('\n')
    expect(runOk(parser, src)).toMatchObject([
      STRUCT('Point', [
        ['x', '0001'],
        ['y', '00FF'],
        ['z', 'ABCD'],
      ]),
    ])
  })

  it('parses cast atom', () => {
    const c = runOk(cast, '<Screen> Screen.CLEAR')
    expect(c).toMatchObject(CAST('Screen', 'Screen', 'CLEAR'))
  })

  it('parses cast inside address expression', () => {
    const a = runOk(addrExpr, '&[<Screen> Screen.CLEAR + $0001]')
    expect(a.type).toBe('ADDRESS')
    expect((a as any).expr.type).toBe('BINARY_OP')

    const bin: any = (a as any).expr
    const left = (bin as any).a ?? (bin as any).lhs
    const right = (bin as any).b ?? (bin as any).rhs

    expect(left).toMatchObject(CAST('Screen', 'Screen', 'CLEAR'))
    expect(right).toMatchObject({ type: 'HEX_LITERAL', raw: '0001', value: 1 })
    expect(bin.op).toMatchObject({ type: 'PLUS', value: '+' })
  })

  // —— Cast friendly errors ——
  it('cast: helpful errors', () => {
    // missing opening '<'
    expect(() => runOk(cast, 'Screen> X.Y')).toThrow(
      /Expected "<" to start cast type/
    )
    // missing closing '>'
    expect(() => runOk(cast, '<Screen X.Y')).toThrow(
      /Expected ">" to end cast type/
    )
    // invalid type
    expect(() => runOk(cast, '<> X.Y')).toThrow(/Invalid cast type/)
    // missing symbol
    expect(() => runOk(cast, '<Screen> .Y')).toThrow(
      /Invalid symbol name after cast type/
    )
    // missing dot
    expect(() => runOk(cast, '<Screen> Screen Y')).toThrow(
      /Expected "\." between symbol and property/
    )
    // missing property
    expect(() => runOk(cast, '<Screen> Screen.')).toThrow(
      /Invalid property name after "\."/
    )
  })

  // Negative cases
  it('fails: missing colon', () => {
    expect(() => runOk(parser, 'struct S { a $01 }')).toThrow(
      /Expected ":" after field name/
    )
  })

  it('fails: bad hex', () => {
    expect(() => runOk(parser, 'struct S { a: $GG }')).toThrow(
      /Invalid hex literal\b/
    )
  })

  it('fails: missing closing brace', () => {
    expect(() => runOk(parser, 'struct S { a: $01')).toThrow(
      /Expected "\}" to end struct body/
    )
  })

  it('fails: missing opening brace', () => {
    expect(() => runOk(parser, 'struct S a: $01 }')).toThrow(
      /Expected "\{" to start struct body/
    )
  })
})
