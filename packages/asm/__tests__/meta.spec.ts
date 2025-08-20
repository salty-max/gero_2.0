import { describe, it, expect } from 'bun:test'
import parser from '@gero/asm/parser'
import { runOk } from './helpers'
import { LAB, CONST, DATA8, DATA16 } from './factory'

describe('Parser ▸ Labels / Constants / Data', () => {
  // ——— Labels ———
  it('parses a label line', () => {
    const ast = runOk(parser, 'start:')
    expect(ast).toEqual([LAB('start')])
  })

  it('label with leading/trailing spaces', () => {
    const ast = runOk(parser, '   loop:   ')
    expect(ast).toEqual([LAB('loop')])
  })

  it('rejects invalid label names', () => {
    expect(() => runOk(parser, '2bad:')).toThrow(/Invalid label\b/)
  })

  // ——— Constants ———
  it('parses constant declaration', () => {
    const ast = runOk(parser, 'const cafe = $CAFE')
    expect(ast).toEqual([CONST('cafe', 'CAFE', false)])
  })

  it('parses exported constant declaration', () => {
    const ast = runOk(parser, '+const beep = $BEEF')
    expect(ast).toEqual([CONST('beep', 'BEEF', true)])
  })

  it('constant tolerates spaces around "="', () => {
    const ast = runOk(parser, 'const dead   =   $DEAD')
    expect(ast).toEqual([CONST('dead', 'DEAD')])
  })

  it('constant: missing or bad value fails', () => {
    expect(() => runOk(parser, 'const x =')).toThrow(/Expected hex literal\b/)
    expect(() => runOk(parser, 'const x = $GHIJ')).toThrow(
      /Invalid hex literal\b/
    )
  })

  // ——— Data 8 ———
  it('parses data8 list', () => {
    const ast = runOk(parser, 'data8 bytes = { $BE, $EF }')
    expect(ast).toEqual([DATA8('bytes', ['BE', 'EF'])])
  })

  it('parses exported data8 list', () => {
    const ast = runOk(parser, '+data8 bytes = { $01, $02, $03 }')
    expect(ast).toEqual([DATA8('bytes', ['01', '02', '03'], true)])
  })

  it('data8 tolerates spaces and no-spaces inside braces', () => {
    expect(runOk(parser, 'data8 xs = {$AA,$BB}')).toEqual([
      DATA8('xs', ['AA', 'BB']),
    ])
    expect(runOk(parser, 'data8 ys = {  $00 ,  $FF  }')).toEqual([
      DATA8('ys', ['00', 'FF']),
    ])
  })

  it('data8: empty list', () => {
    expect(runOk(parser, 'data8 x = {}')).toEqual([DATA8('x', [])])
  })

  it('data8: malformed list fails', () => {
    expect(() => runOk(parser, 'data8 x = { , $AA }')).toThrow(
      /Invalid data8 declaration\b/
    )
  })

  // ——— Data 16 ———
  it('parses data16 list', () => {
    const ast = runOk(parser, 'data16 words = { $BABA, $DEAD }')
    expect(ast).toEqual([DATA16('words', ['BABA', 'DEAD'])])
  })

  it('parses exported data16 list', () => {
    const ast = runOk(parser, '+data16 tab = { $0001, $00FF, $ABCD }')
    expect(ast).toEqual([DATA16('tab', ['0001', '00FF', 'ABCD'], true)])
  })

  // ——— Mixed program lines (integration sanity) ———
  it('parses mixed: const / data / labels / empty lines', () => {
    const src = [
      'const cafe = $CAFE',
      '',
      '+data8 bytes = { $BE, $EF }',
      'data16 words = { $BABA, $DEAD }',
      '',
      'start:',
    ].join('\n')

    const ast = runOk(parser, src)
    expect(ast).toEqual([
      CONST('cafe', 'CAFE', false),
      DATA8('bytes', ['BE', 'EF'], true),
      DATA16('words', ['BABA', 'DEAD'], false),
      LAB('start'),
    ])
  })

  // ——— Helpful errors ———
  it('unknown directive/mnemonic still yields helpful error from instruction path', () => {
    expect(() => runOk(parser, 'dat8 bytes = { $AA }')).toThrow(
      /Unknown mnemonic "dat8"|Unknown mnemonic/i
    )
  })
})
