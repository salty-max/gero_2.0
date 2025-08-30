# @gero/vm

Gero 16‑bit VM runtime: CPU, memory, memory mapping, and devices.

Exports

- `CPU`: 16‑bit CPU with registers (ip, acu, r1..r8, sp, fp, mb, im)
- `MemoryMapper`: map devices into address space (big‑endian words)
- Devices: `createBankedMemory`, `createScreenDevice`
- ISA: `OPCODES`, `OPCODE_METAS`, register helpers (`regIndex`, `REGISTER_NAMES`)
- Debug helpers:
  - `dumpMemory(mm, start=0, length=0x100, opts?)` → print a hex table
  - `toHexDump(mm, start, length, opts?)` → get hex table as string

Usage

```ts
import { CPU, MemoryMapper, createRAM, dumpMemory } from '@gero/vm'

const MM = new MemoryMapper()
const ram = createRAM(0x10000)
MM.map(ram, 0, 0x10000)

const cpu = new CPU(MM)
// ... load a program ...

// After running, dump the first 256 bytes
dumpMemory(MM, 0x0000, 256)
```
