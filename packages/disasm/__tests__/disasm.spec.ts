import { OPCODES, regIndex } from '@gero/vm'
import { describe, expect, it } from 'bun:test'

import { disassemble, type RegionHint } from '../src'
import { fromBytes } from '../src/source'
import {
  assertCodeSpan,
  assertIncompleteSpan,
  assertTableSpan,
  assertUSpan,
} from './helpers'

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
describe('@gero/disasm ▸ truncation & incomplete spans', () => {
  it('emits incomplete span for truncated MOV_IMM_REG missing low byte + reg', () => {
    const bytes = [OPCODES.MOV_IMM_REG, 0x12] // opcode + high byte of imm only
    const res = run(bytes)
    expect(res.spans.length).toBe(1)
    const s = res.spans[0]
    assertIncompleteSpan(s)
    expect(s.size).toBe(2)
    expect(s.bytes).toEqual([OPCODES.MOV_IMM_REG, 0x12])
    expect(res.diags.errors.length).toBe(1)
  })

  it('emits incomplete span at correct base address for truncated instruction', () => {
    const base = 0x2000
    const bytes = [OPCODES.MOV_IMM_REG] // only opcode, missing imm+reg
    const res = run(bytes, { baseAddr: base })
    expect(res.spans.length).toBe(1)
    const s = res.spans[0]
    assertIncompleteSpan(s)
    expect(s.addr).toBe(base)
    expect(s.size).toBe(1)
    expect(s.bytes).toEqual([OPCODES.MOV_IMM_REG])
    expect(res.diags.errors.length).toBe(1)
  })
})

describe('@gero/disasm ▸ MOV8 forms', () => {
  it('decodes MOV8_MEM_REG ( [&addr] → rX ) with correct size/bytes/name', () => {
    // MOV8_MEM_REG &0x0002, r1
    const bytes = [
      OPCODES.MOV8_MEM_REG,
      0x00,
      0x02, // &0x0002 (big-endian)
      regIndex('r1'),
    ]
    const res = run(bytes)

    expect(res.diags.errors.length).toBe(0)
    expect(res.spans.length).toBe(1)

    const s = res.spans[0]
    assertCodeSpan(s)
    expect(s.size).toBe(4)
    expect(s.bytes).toEqual(bytes)
    expect(s.node.name).toBe('MOV8_MEM_REG')
  })

  it('emits incomplete span for truncated MOV8_MEM_REG missing reg byte', () => {
    // opcode + addr only (missing destination reg)
    const bytes = [
      OPCODES.MOV8_MEM_REG,
      0x12,
      0x34, // &0x1234
      // <missing reg>
    ]
    const res = run(bytes)

    expect(res.spans.length).toBe(1)
    const s = res.spans[0]
    assertIncompleteSpan(s)
    expect(s.bytes).toEqual(bytes)
    expect(s.size).toBe(3) // consumed opcode + 2 address bytes
    expect(res.diags.errors.length).toBe(1)
  })

  it('decodes distinct addresses correctly (non-zero high byte)', () => {
    // MOV8_MEM_REG &0x20FE, r3
    const bytes = [OPCODES.MOV8_MEM_REG, 0x20, 0xfe, regIndex('r3')]
    const res = run(bytes)

    expect(res.diags.errors.length).toBe(0)
    const [s] = res.spans
    assertCodeSpan(s)
    expect(s.size).toBe(4)
    expect(s.bytes).toEqual(bytes)
    expect(s.node.name).toBe('MOV8_MEM_REG')
  })
})

describe('@gero/disasm ▸ fuzz', () => {
  it('never throws on random byte sequences (strict=false)', () => {
    const ROUNDS = 200
    for (let i = 0; i < ROUNDS; i++) {
      const len = Math.floor(Math.random() * 64)
      const bytes = Array.from({ length: len }, () =>
        Math.floor(Math.random() * 256)
      )
      let threw = false
      let res
      try {
        res = run(bytes, {
          strict: false,
          maxBytes: 0x10000,
        })
      } catch (e) {
        console.error(e)
        threw = true
      }
      expect(threw).toBe(false)
      if (res) {
        // Basic sanity: end - start should not exceed original length + small overhead (none expected)
        expect(res.end - res.start).toBeLessThanOrEqual(len)
        // Spans cover only forward addresses
        let last = res.start - 1
        for (const span of res.spans) {
          expect(span.addr).toBeGreaterThanOrEqual(res.start)
          expect(span.addr).toBeGreaterThan(last)
          last = span.addr
        }
      }
    }
  })
})
