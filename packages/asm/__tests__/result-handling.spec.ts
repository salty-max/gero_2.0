import { describe, expect, it } from 'bun:test'

import { assemble } from '../src/assemble'
import { AssembleErrorCode, isAssembleError } from '../src/errors'

describe('Result-based assembler (disasm-style)', () => {
  it('should return result with empty diagnostics for valid code', () => {
    const result = assemble(`
      mov $42, r1
      hlt
    `)

    expect(result.bytes).toBeDefined()
    expect(result.symbols).toBeDefined()
    expect(result.diags).toBeDefined()
    expect(result.bytes.length).toBeGreaterThan(0)
    expect(result.diags.errors).toHaveLength(0)
  })

  it('should return result with parse errors in diagnostics', () => {
    const result = assemble('invalid assembly code @#$')

    expect(result.bytes).toBeDefined()
    expect(result.symbols).toBeDefined()
    expect(result.diags).toBeDefined()
    expect(result.diags.errors).toHaveLength(1)
    expect(isAssembleError(result.diags.errors[0])).toBe(true)
    expect(result.diags.errors[0]?.code).toBe(AssembleErrorCode.Parse)
    expect(result.diags.errors[0]?.message).toBeDefined()
  })

  it('should collect unresolved label errors in diagnostics and continue', () => {
    const result = assemble(`
      mov !unknown_label, r1
      hlt
    `)

    expect(result.bytes).toBeDefined()
    expect(result.symbols).toBeDefined()
    expect(result.diags).toBeDefined()
    expect(result.diags.errors).toHaveLength(1)
    expect(isAssembleError(result.diags.errors[0])).toBe(true)
    expect(result.diags.errors[0]?.code).toBe(AssembleErrorCode.UnresolvedLabel)
    expect(result.diags.errors[0]?.message).toContain('unknown_label')
    // Should still produce some bytes (with fallback values)
    expect(result.bytes.length).toBeGreaterThan(0)
  })

  it('should collect duplicate label errors in diagnostics and continue', () => {
    const result = assemble(`
      test:
      mov $1, r1
      test:
      mov $2, r2
      hlt
    `)

    expect(result.bytes).toBeDefined()
    expect(result.symbols).toBeDefined()
    expect(result.diags).toBeDefined()
    expect(result.diags.errors).toHaveLength(1)
    expect(isAssembleError(result.diags.errors[0])).toBe(true)
    expect(result.diags.errors[0]?.code).toBe(AssembleErrorCode.LabelExists)
    expect(result.diags.errors[0]?.message).toContain('test')
    // Should still produce bytes
    expect(result.bytes.length).toBeGreaterThan(0)
  })

  it('should handle complex assembly with labels and constants', () => {
    const src = [
      'const MY_VAL = $00FF',
      '',
      'start:',
      'mov !MY_VAL, r1',
      'jmp !start',
      'hlt',
    ].join('\n')

    const result = assemble(src)

    expect(result.bytes).toBeDefined()
    expect(result.symbols).toBeDefined()
    expect(result.diags).toBeDefined()
    expect(result.diags.errors).toHaveLength(0)
    expect(result.symbols).toHaveProperty('MY_VAL', 0xff)
    expect(result.symbols).toHaveProperty('start', 0)
    expect(result.bytes.length).toBeGreaterThan(0)
  })

  it('computes arithmetic constant expressions (brackets + precedence)', () => {
    const src = [
      // [$0004 * ($0002 + $0001)] = 0x000C
      'const TOTO = $0003',
      'const C1 = [$0004 * ($0002 + $0001)]',
      // [$0002 + [$0003 * $0004]] = 0x000E
      'const C2 = [$0002 + (!TOTO * $0004)]',
    ].join('\n')

    const result = assemble(src)

    expect(result.diags.errors).toHaveLength(0)
    expect(result.symbols).toHaveProperty('C1', 0x000c)
    expect(result.symbols).toHaveProperty('C2', 0x000e)
  })

  it('should collect multiple errors and continue processing', () => {
    const src = [
      'const MY_VAL = $00FF',
      'const MY_VAL = $0042', // Duplicate const
      '',
      'start:',
      'mov !UNKNOWN, r1', // Unknown label
      'mov !MY_VAL, r2',
      'start:', // Duplicate label
      'hlt',
    ].join('\n')

    const result = assemble(src)

    expect(result.bytes).toBeDefined()
    expect(result.symbols).toBeDefined()
    expect(result.diags).toBeDefined()
    expect(result.diags.errors.length).toBeGreaterThan(1)

    // Should have collected all errors
    const errorCodes = result.diags.errors.map((e) => e.code)
    expect(errorCodes).toContain(AssembleErrorCode.ConstExists)
    expect(errorCodes).toContain(AssembleErrorCode.UnresolvedLabel)
    expect(errorCodes).toContain(AssembleErrorCode.LabelExists)

    // Should still produce some bytes despite errors
    expect(result.bytes.length).toBeGreaterThan(0)
  })
})
