import { describe, expect, it } from 'bun:test'

import {
  buildState,
  completions,
  definition,
  documentSymbols,
  hover,
} from '../src/features'

const uri = 'file:///test.asm'

describe('asm-lsp ▸ features', () => {
  it('buildState collects labels, bytes, and has no errors for valid code', () => {
    const src = `; simple program\nstart:\n  mov $0001, acu\n  add $0001, acu\n`
    const s = buildState(uri, src)
    expect(s.uri).toBe(uri)
    expect(s.text.length).toBeGreaterThan(0)
    expect(s.labels.has('start')).toBeTrue()
    expect(s.diags.length).toBe(0)
    expect(s.bytes && s.bytes.length).toBeGreaterThan(0)
  })

  it('completions include mnemonics, registers, and discovered labels', () => {
    const src = `start:\n  mov $0001, acu\n`
    const s = buildState(uri, src)
    const c = completions(s)
    const labels = c.items.map((i) => i.label)
    expect(labels).toContain('mov')
    expect(labels).toContain('acu')
    expect(labels).toContain('start')
  })

  it('hover shows assembled bytes for a valid instruction line', () => {
    const src = `mov $0002, acu\n`
    const s = buildState(uri, src)
    const h = hover(s, { line: 0, character: 1 })
    expect(h).not.toBeNull()
    // Basic sanity: formatted markdown with bytes
    // @ts-expect-error – guarding for null above
    expect(h.contents.kind).toBe('markdown')
    // @ts-expect-error – guarding for null above
    expect(String(h.contents.value)).toContain('bytes:')
  })

  it('definition resolves label references', () => {
    const src = `start:\n  mov $0001, acu\n  jmp !start\n`
    const s = buildState(uri, src)
    // Position inside the word "start" on the jmp line
    const d = definition(s, { line: 2, character: 9 })
    expect(d).not.toBeNull()
    // Should point to the label definition (line 0; zero-based index)
    // @ts-expect-error – guarding for null above
    expect(d.range.start.line).toBe(0)
  })

  it('documentSymbols lists discovered labels', () => {
    const src = `alpha:\n  hlt\n`
    const s = buildState(uri, src)
    const syms = documentSymbols(s)
    expect(syms.map((s) => s.name)).toContain('alpha')
  })

  it('buildState reports diagnostics on unresolved symbols', () => {
    const src = `jmp !missing_label\n`
    const s = buildState(uri, src)
    expect(s.diags.length).toBeGreaterThan(0)
  })
})
