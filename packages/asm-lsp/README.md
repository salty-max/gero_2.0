# @gero/asm

Assembler for the Gero 16‑bit VM.

Main API

- `assemble(source: string, opts?: { onError?: 'exit' | 'throw' })`
  - Default `onError: 'exit'` prints a nice error and exits the process.
  - `onError: 'throw'` throws an Error instead.
  - Returns `{ bytes: number[]; symbols: Record<string, number> }` on success.

- `parser` (Parsil parser) and helpers `parseOrExit`, `parseOrReport`.

Usage

```ts
import { assemble, parser, parseOrExit } from '@gero/asm'

const src = `
  const cafe = $CAFE
  start:
    mov !cafe, &[$20 + ($03 * $10)]
    hlt
`

// Assemble and get bytes/symbols
const { bytes, symbols } = assemble(src)

// Access the AST directly
const ast = parseOrExit(parser, src)
```

Hex table

```ts
import { toHexTable, printHexTable } from '@gero/asm'

console.log(toHexTable([0x10, 0x12, 0x34]))
```
