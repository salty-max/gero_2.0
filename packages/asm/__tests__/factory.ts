// NOTE: test-side factories build expected shapes for deep equality
// without the new `loc` spans. We intentionally avoid importing AST
// types here to keep expectations minimal and resilient to internal changes.
import type { OpcodeName } from '@gero/vm/instructions'
import type { RegName } from '@gero/vm/register'

export const REG = (name: RegName) =>
  ({ type: 'REGISTER', value: name }) as const

export const REG_PTR = (name: RegName) =>
  ({ type: 'REGISTER_PTR', value: name }) as const

export const ADDR_HEX = (raw: string) =>
  ({
    type: 'ADDRESS',
    expr: {
      type: 'ADDR_LITERAL',
      raw,
      value: parseInt(raw.replace(/^\$/, ''), 16),
    },
  }) as const

export const ADDR = (node: any) => ({ type: 'ADDRESS', expr: node }) as const

export const INS = (opcode: OpcodeName | string, ...args: any[]) => ({
  type: 'INSTRUCTION',
  opcode: opcode as OpcodeName,
  args,
})

export const HEX = (raw: string) => ({
  type: 'HEX_LITERAL',
  raw,
  value: parseInt(raw, 16),
})

export const VAR = (name: string) => ({
  type: 'VARIABLE',
  value: name,
})

export const PLUS = { type: 'PLUS', value: '+' } as const
export const MINUS = { type: 'MINUS', value: '-' } as const
export const FACTOR = { type: 'FACTOR', value: '*' } as const

export const BIN = (a: any, op: any, b: any) => ({
  type: 'BINARY_OP',
  lhs: a,
  op,
  rhs: b,
})

export const SQ1 = (n: any) => ({
  type: 'SQUARE_BRACKET_EXPR',
  expr: [n],
})

export const PAR1 = (n: any) => ({
  type: 'PAREN_EXPR',
  expr: [n],
})

export const LAB = (name: string) => ({
  type: 'LABEL',
  value: name,
})

export const CONST = (name: string, hexRaw: string, isExport = false) => ({
  type: 'CONSTANT',
  name,
  isExport,
  value: HEX(hexRaw),
})

const DATA = (
  size: 8 | 16,
  name: string,
  raws: string[],
  isExport = false
) => ({
  type: 'DATA',
  size,
  name,
  isExport,
  values: raws.map(HEX),
})

export const DATA8 = (name: string, raws: string[], isExport = false) =>
  DATA(8, name, raws, isExport)
export const DATA16 = (name: string, raws: string[], isExport = false) =>
  DATA(16, name, raws, isExport)

export const STRUCT = (
  name: string,
  entries: readonly [key: string, raw: string][],
  isExport = false
) => ({
  type: 'STRUCT',
  name,
  isExport,
  members: entries.map(([key, raw]) => ({ key, value: HEX(raw) })),
})

export const CAST = (structure: string, symbol: string, property: string) => ({
  type: 'CAST',
  structure,
  symbol,
  property,
})
