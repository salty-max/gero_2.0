# gero

Gero is a 16‑bit VM and assembler written in TypeScript (Bun) with a Turborepo monorepo.

Install dependencies

```bash
bun install
```

Monorepo layout

- packages/
  - `@gero/vm`: VM runtime (CPU, memory, memory‑mapper, devices, ISA)
  - `@gero/asm`: Assembler (parser + encoder API)
  - `@gero/util`: Shared utilities (ANSI/log helpers, hex table renderer)
- apps/
  - `gero-cli`: CLI to assemble and run programs on the VM

VM Overview

- Word size: 16‑bit, big‑endian for words in memory and IVT.
- Registers:
  - `ip`: instruction pointer
  - `acu`: accumulator (target of arithmetic/logic ops)
  - `r1..r8`: general purpose
  - `sp` / `fp`: stack pointer / frame pointer (stack grows downward)
  - `mb`: memory bank select register (used by banked devices)
  - `im`: 16‑bit interrupt mask (one bit per vector)
- Memory:
  - Mapped via `MemoryMapper` into regions (RAM or devices)
  - 16‑bit word accesses are big‑endian
  - Banked device helper: `createBankedMemory(n=8, bankSize=0x100)`
    - Word accesses wrap the low byte at the bank boundary (addr+1 mod bankSize)
- Stack:
  - `push`: writes word at `sp`, then `sp -= 2`
  - `pop`: `sp += 2`, then reads word at new `sp`
  - Subroutine call saves registers + return address and restores on `ret`
- Interrupts:
  - 16 vectors (`INT value % 0x10`)
  - Vector table base: `0x1000` (word pointers, big‑endian)
  - Masking via `im`; `RET_INT` returns from ISR and clears ISR flag
- ISA (high‑level):
  - Moves: `mov`/`mov8` between regs, memory, literals
  - Arithmetic/logic: `add/sub/mul/and/or/xor/not/inc/dec`
  - Shifts: `lsh`/`rsh` (lit or reg count)
  - Branches: `jeq/jne/jlt/jgt/jle/jge` (against `acu`)
  - Calls: `call` (lit or reg) and `ret`
  - Ints: `int` and `rti`

Assembler Syntax (quick)

- Hex literal: `$ABCD`; 8‑bit: `$7F`
- Constant: `const name = $BEEF`
- Data: `data8 bytes = { $BE, $EF }`, `data16 words = { $BABA, $DEAD }`
- Labels: `start:`
- Registers: `r1..r8`, `acu`, `ip`, `sp`, `fp`, `mb`, `im`
- Memory address:
  - `&$1234` for absolute
  - `&[ ... ]` with `+`, `-`, `*`, and variables (e.g. `&[!SCR + $0001]`)
- Variables: `!name` (resolve to constants, data labels, or labels)

Devices

- Screen device (CLI demo): mapped at `0x8000..0x80FF` (16×16). Each word write:
  - High byte is a command (optional):
    - `0xFF00` clear screen, `0x0100` bold on, `0x0200` reset, `0x0300` blue, `0x0400` red
  - Low byte is the ASCII character to draw at that cell (row major)
  - Example (see `apps/cli/examples/hello.asm`):
    - `const SCR = $8000`
    - `mov $FF00, &[!SCR]` (clear)
    - `mov $0048, &[!SCR]` (H)
    - `mov $0065, &[!SCR + $0001]` (e)

Common tasks (root)

```bash
# Develop (runs package-level dev scripts)
bun run dev

# Build all packages (ESM + .d.ts)
bun run build

# Typecheck all packages
bun run typecheck

# Run tests across packages
bun run test
```

CLI usage (apps/cli)

```bash
# dev run against example program
bun run dev

# build a single CLI bundle
cd apps/cli && bun run build

# run the CLI directly (Bun)
bun apps/cli/src/cli.ts path/to/program.asm --steps 1000
```

Zed editor setup (highlighting via LSP)

- Files: `.asm`, `.gasm`
- Comments: `;` to end of line
- Registers: `ip, acu, r1..r8, sp, fp, mb, im`
- Mnemonics: `mov, mov8, lmov, hmov, push, pop, add, sub, mul, lsh, rsh, and, or, xor, not, inc, dec, swp, neg, jmp, jeq, jne, jlt, jgt, jle, jge, jz, jnz, call, ret, int, rti, brk, hlt` (and forms)

A project-local Zed extension is provided at `.zed/extensions/gero-asm/extension.toml` and will:

- Register the Gero ASM language for `.asm`/`.gasm` files.
- Launch the LSP (`packages/asm-lsp/src/cli.ts` via `bun`) with stdio.
- Provide semantic tokens so Zed can color mnemonics, registers, numbers, addresses, labels, and operators.

Usage:

- Open this repo in Zed. It will load the workspace extension automatically.
- Ensure `bun` is on your PATH; the extension spawns `bun packages/asm-lsp/src/cli.ts`.
- Optional: set any theme; tokens map to `keyword`, `variable`, `number`, `operator`, `type`, `macro`.

Tree-sitter grammar + Zed package

- Grammar: `packages/asm-grammar` (Tree-sitter `grammar.js` + `queries/highlights.scm`).
- Zed package: `packages/zed-asm` (loads wasm + queries and attaches the LSP).
- Build + copy wasm to both Zed packages:
  - `cd packages/asm-grammar`
  - `bun run prep:zed` (requires `tree-sitter` CLI on PATH)
    - Copies wasm to `packages/zed-asm/wasm/gero_asm.wasm`
    - Copies wasm to `.zed/extensions/gero-asm/wasm/gero_asm.wasm`

Assembler API (from `@gero/asm`)

```ts
import { assemble, parser, parseOrExit } from '@gero/asm'

const source = `
  const loc = $0100
  start:
    mov $BEEF, &[$00FF]
    hlt
`

// Default behavior: exits on parse error
const { bytes, symbols } = assemble(source)

// Throw on parse error instead
const res = assemble(source, { onError: 'throw' })

// Direct parser access
const ast = parseOrExit(parser, source)
```

Hex table renderer (from `@gero/util` or re‑exported by `@gero/asm`)

```ts
import { toHexTable, printHexTable } from '@gero/util/hex-table'
// or: import { toHexTable } from '@gero/asm'

const bytes = [0x10, 0x12, 0x34, 0xff]
console.log(toHexTable(bytes, { startAddress: 0x8000 }))
// or
printHexTable(bytes)
```

Notes

- In dev, packages export their source (`exports["."].import → ./src/index.ts`).
- Builds output ESM bundles and declaration files into `dist/` for each package.

CI

The GitHub Actions workflow runs install → typecheck → lint → test → build using Turbo.

Environment

This project uses Bun v1.2.20. See https://bun.com for details.
