# @gero/util

Shared utilities for the Gero monorepo.

Exports

- Logger utilities (ANSI helpers)
  - `ANSI_*` constants, `paint`, `printf`, `fmt8`, `fmt16`
  - `import { ANSI_BLUE, printf } from '@gero/util'`

- Hex table renderer
  - `toHexTable(bytes, opts?)` → string
  - `printHexTable(bytes, opts?)` → void
  - `import { toHexTable, printHexTable } from '@gero/util/hex-table'`

Example

```ts
import { printHexTable } from '@gero/util/hex-table'

const program = [0x10, 0x12, 0x34, 0xff]
printHexTable(program, { startAddress: 0x8000 })
```

