import { describe, it, expect } from 'bun:test'
import { runOk } from './helpers'
import {
  register,
  registerPtr,
  hexLiteral,
  variable,
  addrExpr,
} from '@gero/asm/parser/common'
import type { AddrLitNode } from '@gero/asm/parser/types'

describe('Parser ▸ Atoms', () => {
  it('parses register', () => {
    const n = runOk(register, 'r4')
    expect(n.type).toBe('REGISTER')
    expect(n.value).toBe('r4')
  })

  it('parses register ptr', () => {
    const n = runOk(registerPtr, '&r3')
    expect(n.type).toBe('REGISTER_PTR')
    expect(n.value).toBe('r3')
  })

  it('parses hex literal', () => {
    const n = runOk(hexLiteral, '$2A')
    expect(n).toEqual({ type: 'HEX_LITERAL', raw: '2A', value: 0x2a })
  })

  it('parses variable', () => {
    const n = runOk(variable, '!loc')
    expect(n).toEqual({ type: 'VARIABLE', value: 'loc' })
  })

  it('parses address', () => {
    const a1 = runOk(addrExpr, '&42')
    expect(a1.type).toBe('ADDRESS')
    expect(a1.expr.type).toBe('ADDR_LITERAL')
    expect((a1.expr as AddrLitNode).value).toBe(0x42)

    const a2 = runOk(addrExpr, '&[$10 + !var]')
    expect(a2.type).toBe('ADDRESS')
    expect(a2.expr).toEqual({
      type: 'BINARY_OP',
      a: {
        type: 'HEX_LITERAL',
        value: 0x10,
        raw: '10',
      },
      b: {
        type: 'VARIABLE',
        value: 'var',
      },
      op: {
        type: 'PLUS',
        value: '+',
      },
    })
  })
})
