import { describe, it, expect } from 'bun:test'
import { runOk } from './helpers'

import {
  HEX,
  VAR,
  PLUS,
  FACTOR,
  BIN,
  REG,
  ADDR_HEX,
  ADDR,
  INS,
  REG_PTR,
} from './factory'
import parser from '../../src/asm/parser'

describe('Parser ▸ Instructions', () => {
  // ————— MOV family —————
  it('mov imm16, reg         → MOV_LIT_REG', () => {
    const n = runOk(parser, 'mov $1234, r1')
    expect(n).toEqual([INS('MOV_LIT_REG', HEX('1234'), REG('r1'))])
  })

  it('mov reg, reg           → MOV_REG_REG', () => {
    const n = runOk(parser, 'mov r2, r3')
    expect(n).toEqual([INS('MOV_REG_REG', REG('r2'), REG('r3'))])
  })

  it('mov &[$02 + $03], r4   → MOV_MEM_REG', () => {
    const n = runOk(parser, 'mov &[$02 + $03], r4')
    expect(n).toEqual([
      INS('MOV_MEM_REG', ADDR(BIN(HEX('02'), PLUS, HEX('03'))), REG('r4')),
    ])
  })

  it('mov r4, &0042          → MOV_REG_MEM', () => {
    const n = runOk(parser, 'mov r4, &0042')
    expect(n).toEqual([INS('MOV_REG_MEM', REG('r4'), ADDR_HEX('0042'))])
  })

  it('mov $BEEF, &1234       → MOV_LIT_MEM', () => {
    const n = runOk(parser, 'mov $BEEF, &1234')
    expect(n).toEqual([INS('MOV_LIT_MEM', HEX('BEEF'), ADDR_HEX('1234'))])
  })

  it('mov8 &0100, r1         → MOV8_MEM_REG', () => {
    const n = runOk(parser, 'mov8 &0100, r1')
    expect(n).toEqual([INS('MOV8_MEM_REG', ADDR_HEX('0100'), REG('r1'))])
  })

  it('mov8 $7F, &0200        → MOV8_LIT_MEM', () => {
    const n = runOk(parser, 'mov8 $7F, &0200')
    expect(n).toEqual([INS('MOV8_LIT_MEM', HEX('7F'), ADDR_HEX('0200'))])
  })

  it('mov $1000, r1, r2      → MOV_LIT_OFF_REG', () => {
    const n = runOk(parser, 'mov $1000, r1, r2')
    expect(n).toEqual([
      INS('MOV_LIT_OFF_REG', HEX('1000'), REG('r1'), REG('r2')),
    ])
  })

  it('mov &r1, r2            → MOV_REG_PTR_REG', () => {
    const n = runOk(parser, 'mov &r1, r2')
    expect(n).toEqual([INS('MOV_REG_PTR_REG', REG_PTR('r1'), REG('r2'))])
  })

  // ————— Stack —————
  it('push $1234             → PSH_LIT', () => {
    const n = runOk(parser, 'push $1234')
    expect(n).toEqual([INS('PSH_LIT', HEX('1234'))])
  })

  it('push r3                → PSH_REG', () => {
    const n = runOk(parser, 'push r3')
    expect(n).toEqual([INS('PSH_REG', REG('r3'))])
  })

  it('pop r1                 → POP', () => {
    const n = runOk(parser, 'pop r1')
    expect(n).toEqual([INS('POP', REG('r1'))])
  })

  // ————— Arithmetic —————
  it('add $1, r1             → ADD_LIT_REG', () => {
    const n = runOk(parser, 'add $0001, r1')
    expect(n).toEqual([INS('ADD_LIT_REG', HEX('0001'), REG('r1'))])
  })

  it('add r1, r2             → ADD_REG_REG', () => {
    const n = runOk(parser, 'add r1, r2')
    expect(n).toEqual([INS('ADD_REG_REG', REG('r1'), REG('r2'))])
  })

  it('sub $2, r1             → SUB_LIT_REG', () => {
    const n = runOk(parser, 'sub $0002, r1')
    expect(n).toEqual([INS('SUB_LIT_REG', HEX('0002'), REG('r1'))])
  })

  it('sub r1, $2             → SUB_REG_LIT', () => {
    const n = runOk(parser, 'sub r1, $0002')
    expect(n).toEqual([INS('SUB_REG_LIT', REG('r1'), HEX('0002'))])
  })

  it('sub r1, r2             → SUB_REG_REG', () => {
    const n = runOk(parser, 'sub r1, r2')
    expect(n).toEqual([INS('SUB_REG_REG', REG('r1'), REG('r2'))])
  })

  it('mul $3, r1             → MUL_LIT_REG', () => {
    const n = runOk(parser, 'mul $0003, r1')
    expect(n).toEqual([INS('MUL_LIT_REG', HEX('0003'), REG('r1'))])
  })

  it('mul r1, r2             → MUL_REG_REG', () => {
    const n = runOk(parser, 'mul r1, r2')
    expect(n).toEqual([INS('MUL_REG_REG', REG('r1'), REG('r2'))])
  })

  // ————— Shifts —————
  it('lsh r1, $3             → LSH_REG_LIT', () => {
    const n = runOk(parser, 'lsh r1, $0003')
    expect(n).toEqual([INS('LSH_REG_LIT', REG('r1'), HEX('0003'))])
  })

  it('lsh r1, r2             → LSH_REG_REG', () => {
    const n = runOk(parser, 'lsh r1, r2')
    expect(n).toEqual([INS('LSH_REG_REG', REG('r1'), REG('r2'))])
  })

  it('rsh r1, $1             → RSH_REG_LIT', () => {
    const n = runOk(parser, 'rsh r1, $0001')
    expect(n).toEqual([INS('RSH_REG_LIT', REG('r1'), HEX('0001'))])
  })

  it('rsh r1, r2             → RSH_REG_REG', () => {
    const n = runOk(parser, 'rsh r1, r2')
    expect(n).toEqual([INS('RSH_REG_REG', REG('r1'), REG('r2'))])
  })

  // ————— Bitwise —————
  it('and r1, $FF            → AND_REG_LIT', () => {
    const n = runOk(parser, 'and r1, $00FF')
    expect(n).toEqual([INS('AND_REG_LIT', REG('r1'), HEX('00FF'))])
  })

  it('and r1, r2             → AND_REG_REG', () => {
    const n = runOk(parser, 'and r1, r2')
    expect(n).toEqual([INS('AND_REG_REG', REG('r1'), REG('r2'))])
  })

  it('or r1, $3              → OR_REG_LIT', () => {
    const n = runOk(parser, 'or r1, $0003')
    expect(n).toEqual([INS('OR_REG_LIT', REG('r1'), HEX('0003'))])
  })

  it('or r1, r2              → OR_REG_REG', () => {
    const n = runOk(parser, 'or r1, r2')
    expect(n).toEqual([INS('OR_REG_REG', REG('r1'), REG('r2'))])
  })

  it('xor r1, $3             → XOR_REG_LIT', () => {
    const n = runOk(parser, 'xor r1, $0003')
    expect(n).toEqual([INS('XOR_REG_LIT', REG('r1'), HEX('0003'))])
  })

  it('xor r1, r2             → XOR_REG_REG', () => {
    const n = runOk(parser, 'xor r1, r2')
    expect(n).toEqual([INS('XOR_REG_REG', REG('r1'), REG('r2'))])
  })

  it('not r1                 → NOT', () => {
    const n = runOk(parser, 'not r1')
    expect(n).toEqual([INS('NOT', REG('r1'))])
  })

  it('inc / dec              → INC_REG / DEC_REG', () => {
    expect(runOk(parser, 'inc r1')).toEqual([INS('INC_REG', REG('r1'))])
    expect(runOk(parser, 'dec r1')).toEqual([INS('DEC_REG', REG('r1'))])
  })

  // ————— Jumps —————
  it('jeq r1, &1000          → JEQ_REG', () => {
    const n = runOk(parser, 'jeq r1, &1000')
    expect(n).toEqual([INS('JEQ_REG', REG('r1'), ADDR_HEX('1000'))])
  })

  it('jeq $1234, &[$02 + !x] → JEQ_LIT', () => {
    const n = runOk(parser, 'jeq $1234, &[$02 + !x]')
    expect(n).toEqual([
      INS('JEQ_LIT', HEX('1234'), ADDR(BIN(HEX('02'), PLUS, VAR('x')))),
    ])
  })

  it('jgt r7, &0002          → JGT_REG', () => {
    const n = runOk(parser, 'jgt r7, &0002')
    expect(n).toEqual([INS('JGT_REG', REG('r7'), ADDR_HEX('0002'))])
  })

  it('jle $0005, &00FF       → JLE_LIT', () => {
    const n = runOk(parser, 'jle $0005, &00FF')
    expect(n).toEqual([INS('JLE_LIT', HEX('0005'), ADDR_HEX('00FF'))])
  })

  // ————— Calls / control —————
  it('call &1234             → CAL_LIT', () => {
    const n = runOk(parser, 'call &1234')
    expect(n).toEqual([INS('CAL_LIT', ADDR_HEX('1234'))])
  })

  it('call r1                → CAL_REG', () => {
    const n = runOk(parser, 'call r1')
    expect(n).toEqual([INS('CAL_REG', REG('r1'))])
  })

  it('ret / hlt / nop        → RET / HLT / NO_OP', () => {
    expect(runOk(parser, 'ret')).toEqual([INS('RET')])
    expect(runOk(parser, 'hlt')).toEqual([INS('HLT')])
    expect(runOk(parser, 'nop')).toEqual([INS('NO_OP')])
  })

  // ————— Spacing / folding sanity —————
  it('folds nested math in address', () => {
    const n = runOk(parser, 'mov &[$02 + ($03 * $04)], r1')
    expect(n).toEqual([
      INS(
        'MOV_MEM_REG',
        ADDR(BIN(HEX('02'), PLUS, BIN(HEX('03'), FACTOR, HEX('04')))),
        REG('r1')
      ),
    ])
  })

  // —— separators / spacing ——
  it('accepts comma with/without surrounding spaces', () => {
    expect(runOk(parser, 'add $0001,r1')).toEqual([
      INS('ADD_LIT_REG', HEX('0001'), REG('r1')),
    ])
    expect(runOk(parser, 'add $0001 , r1')).toEqual([
      INS('ADD_LIT_REG', HEX('0001'), REG('r1')),
    ])
  })

  it('allows zero spaces inside [], but not multiples', () => {
    expect(runOk(parser, 'mov &[$02+$03*$04], r1')).toEqual([
      INS(
        'MOV_MEM_REG',
        ADDR(BIN(HEX('02'), PLUS, BIN(HEX('03'), FACTOR, HEX('04')))),
        REG('r1')
      ),
    ])
    expect(() => runOk(parser, 'mov &[  $02  +   $03], r1')).toThrow()
  })

  // —— case sensitivity ——
  it('is case-insensitive', () => {
    expect(runOk(parser, 'MOV $1234, r1')).toEqual([
      INS('MOV_LIT_REG', HEX('1234'), REG('r1')),
    ])
    expect(runOk(parser, ' HLT ')).toEqual([INS('HLT')])
  })

  it('fails if comma is missing between operands', () => {
    expect(() => runOk(parser, 'add $0001  r1')).toThrow()
  })

  it('fails on double comma', () => {
    expect(() => runOk(parser, 'add $0001,, r1')).toThrow()
  })

  it('fails on trailing comma', () => {
    expect(() => runOk(parser, 'add $0001,')).toThrow()
  })

  // —— wrong forms (negative checks) ——
  it('rejects unknown registers', () => {
    expect(() => runOk(parser, 'mov $0001, rx')).toThrow()
  })

  it('rejects unknown mnemonic', () => {
    expect(() => runOk(parser, 'moov $0001, r1')).toThrow(
      /Unknown mnemonic "moov"/
    )
    expect(() => runOk(parser, 'mov8x $7F, &0200')).toThrow(
      /Unknown mnemonic "mov8x"/
    )
  })

  // ————— Negative quick checks (messages may vary) —————
  it('fails: bad arg count (mov missing dst)', () => {
    expect(() => runOk(parser, 'mov r1')).toThrow(
      /Expected \",\" between operands\b/
    )
  })

  it('fails: wrong arg kinds (add r1, $2 is unsupported form)', () => {
    expect(() => runOk(parser, 'add r1, $0002')).toThrow(/Unknown register\b/)
  })

  it('fails: wrong types (pop $1)', () => {
    expect(() => runOk(parser, 'pop $0001')).toThrow(/Unknown register\b/)
  })

  it('fails: hlt with extra stuff', () => {
    expect(() => runOk(parser, 'hlt r1')).toThrow(
      /HLT does not take any arguments/
    )
  })

  it('fails: ugly internal spacing inside address', () => {
    expect(() => runOk(parser, 'mov &[  $02  +   $03], r1')).toThrow()
  })

  // ————— Program / lines —————
  it('parses multiple lines without trailing newline', () => {
    const n = runOk(parser, 'mov $1234, r1\nhlt')
    expect(n).toEqual([INS('MOV_LIT_REG', HEX('1234'), REG('r1')), INS('HLT')])
  })

  // ————— Helpful explicit errors —————
  it('rejects parenthesized immediate expressions', () => {
    // should suggest using a hex literal or &[ ... ]
    expect(() => runOk(parser, 'mov ($CA00 + $00FE), r4')).toThrow(
      /Parenthesized expressions are not allowed as a top-level immediate\./
    )
  })
})
