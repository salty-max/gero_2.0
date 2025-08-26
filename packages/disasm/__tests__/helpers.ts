import type { Span } from '../src'

export type CodeSpan = Extract<Span, { kind: 'code' }>
export type USpan = Extract<Span, { kind: 'u8' | 'u16' }>
export type TableSpan = Extract<Span, { kind: 'table8' | 'table16' }>

export function assertCodeSpan(
  span: Span | undefined
): asserts span is CodeSpan {
  if (!span || span.kind !== 'code') {
    throw new Error(
      `Expected code span, got: ${span ? span.kind : 'undefined'}`
    )
  }
}

export function assertUSpan(span: Span | undefined): asserts span is USpan {
  if (!span || (span.kind !== 'u8' && span.kind !== 'u16')) {
    throw new Error(
      `Expected u8 or u16 span, got: ${span ? span.kind : 'undefined'}`
    )
  }
}

export function assertTableSpan(
  span: Span | undefined
): asserts span is TableSpan {
  if (!span || (span.kind !== 'table8' && span.kind !== 'table16')) {
    throw new Error(
      `Expected table8 or table16 span, got: ${span ? span.kind : 'undefined'}`
    )
  }
}

export function assertIncompleteSpan(
  span: Span | undefined
): asserts span is Extract<Span, { kind: 'incomplete' }> {
  if (!span || span.kind !== 'incomplete') {
    throw new Error(
      `Expected incomplete span, got: ${span ? span.kind : 'undefined'}`
    )
  }
}
