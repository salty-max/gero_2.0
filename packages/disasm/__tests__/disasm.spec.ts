import { disassemble, type RegionHint } from '@gero/disasm'
import { OPCODES, regIndex } from '@gero/vm'
import { describe, expect, it } from 'bun:test'

import { fromBytes } from '../src/source'
import { assertCodeSpan, assertTableSpan, assertUSpan } from './helpers'

function run(bytes: number[], opts: Parameters<typeof disassemble>[1] = {}) {
  const src = fromBytes(Uint8Array.from(bytes))
  return disassemble(src, opts)
}

describe('@gero/disasm ▸ basic decoding', () => {
  it('decodes MOV_IMM_REG and MOV_REG_REG with correct bytes/size/name', () => {
    const bytes = [
      OPCODES.MOV_IMM_REG,
      0xab,
      0xcd,
      regIndex('r1'),
      OPCODES.MOV_REG_REG,
      regIndex('r1'),
      regIndex('r2'),
    ]

    const res = run(bytes)

    expect(res.diags.errors.length).toBe(0)
    expect(res.spans.length).toBe(2)

    const [s1, s2] = res.spans
    assertCodeSpan(s1)
    expect(s1.size).toBe(4)
    expect(s1.bytes).toEqual([OPCODES.MOV_IMM_REG, 0xab, 0xcd, regIndex('r1')])
    expect(s1.node.name).toBe('MOV_IMM_REG')

    assertCodeSpan(s2)
    expect(s2.size).toBe(3)
    expect(s2.bytes).toEqual([
      OPCODES.MOV_REG_REG,
      regIndex('r1'),
      regIndex('r2'),
    ])
    expect(s2.node.name).toBe('MOV_REG_REG')
  })

  it('resumes after unknown opcode in non-strict mode and records a u8 span', () => {
    const unknown = 0x99
    const bytes = [unknown, OPCODES.MOV_IMM_REG, 0x12, 0x34, regIndex('r3')]
    const res = run(bytes)

    expect(res.diags.errors.length).toBeGreaterThanOrEqual(1)
    expect(res.spans.length).toBe(2)

    const [d, code] = res.spans
    assertUSpan(d)
    expect(d.value).toBe(unknown)

    assertCodeSpan(code)
    expect(code.node.name).toBe('MOV_IMM_REG')
    expect(code.bytes).toEqual([
      OPCODES.MOV_IMM_REG,
      0x12,
      0x34,
      regIndex('r3'),
    ])
  })

  it('stops at first error in strict mode', () => {
    const unknown = 0x99
    const bytes = [unknown, 0x00]
    const res = run(bytes, { strict: true })

    expect(res.diags.errors.length).toBe(1)
    expect(res.spans.length).toBe(0)
    // end should equal start when nothing consumed
    expect(res.end).toBe(res.start)
  })
})

describe('@gero/disasm ▸ addressing and regions', () => {
  it('respects baseAddr for span addresses', () => {
    const base = 0x1000
    const bytes = [0x00]
    const res = run(bytes, { baseAddr: base })
    expect(res.spans.length).toBe(1)
    const [s] = res.spans
    expect(s?.addr).toBe(base)
  })

  it('table16 region decodes 16-bit big-endian values and length', () => {
    const bytes = [0x01, 0x02, 0x03, 0x04]
    const regions: RegionHint[] = [
      { start: 0x0000, length: 4, type: 'table16' },
    ]
    const res = run(bytes, { regions })
    expect(res.diags.errors.length).toBe(0)
    expect(res.spans.length).toBe(1)
    const [t] = res.spans
    assertTableSpan(t)
    expect(t.size).toBe(4)
    expect(t.values).toEqual([0x0102, 0x0304])
  })

  it('u8 region forces data even within code stream', () => {
    const bytes = [0x70, 0x42, 0x02, 0xbe]
    const regions: RegionHint[] = [{ start: 0x0004, length: 1, type: 'u8' }]
    const res = run(bytes, { regions })
    expect(res.spans.length).toBe(2)
    const [c, d] = res.spans
    assertCodeSpan(c)
    assertUSpan(d)
    expect(d?.value).toBe(0xbe)
  })
})
