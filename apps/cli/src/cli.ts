#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assemble } from '@gero/asm'
import { CPU, dumpMemory } from '@gero/vm'
import { createScreenDevice } from '@gero/vm/devices/screen-device'
import MemoryMapper from '@gero/vm/memory-mapper'
import { createMemory } from '@gero/vm/memory'
import { ANSI_BLUE, ANSI_BOLD, printf } from '@gero/util'

function usage(): never {
  console.log(
    'Usage: bun run apps/cli/src/cli.ts <program.asm> [--steps N] [--dump [START[:LEN]]]\n' +
      '  --steps N            Run at most N instructions (default: 1000)\n' +
      '  --dump [S[:L]]       Hexdump memory after run (default: 0:256)'
  )
  process.exit(1)
}

function runVm(bytes: number[], maxSteps = 1000, startIp = 0x0000) {
  const MM = new MemoryMapper()
  const ram = createMemory(0x10000)
  MM.map(ram, 0, 0xffff)
  // Map a simple text screen device at 0x8000..0x80FF (16x16 grid)
  const screen = createScreenDevice()
  MM.map(screen, 0x8000, 0x80ff, true)
  const cpu = new CPU(MM)

  // load program at 0x0000
  for (let i = 0; i < bytes.length; i++) MM.setUint8(i, bytes[i]! & 0xff)
  cpu.setRegister('ip', startIp & 0xffff)

  let steps = 0
  while (steps < maxSteps) {
    const halted = cpu.step()
    if (halted) break
    steps++
  }
  return { steps, mm: MM }
}

function moveCursorBelowScreen() {
  try {
    // Reset attributes and move cursor to row 18, col 1 (below 16x16 screen)
    process.stdout.write('\x1b[0m\x1b[18;1H')
  } catch {}
}

function main() {
  const args = process.argv.slice(2)
  if (args.length < 1) usage()

  let file = ''
  let steps = 1000
  let dump: { start: number; len: number } | null = null
  let dumpRequested = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--steps') {
      const n = Number(args[++i])
      if (!Number.isFinite(n) || n <= 0) usage()
      steps = Math.floor(n)
    } else if (a === '--dump') {
      const next = args[i + 1]
      if (!next || next.startsWith('--')) {
        dumpRequested = true
        dump = { start: 0, len: -1 } // fill len after assemble
      } else {
        i++
        const [sRaw, lRaw] = next.split(':')
        const parse = (v: string | undefined, def: number) =>
          v ? parseInt(v.replace(/^0x/i, ''), 16) || Number(v) || def : def
        const start = parse(sRaw, 0)
        const len = parse(lRaw, 256)
        dump = { start, len }
      }
    } else if (!file) {
      file = a
    } else {
      usage()
    }
  }

  const srcPath = resolve(process.cwd(), file)
  const src = readFileSync(srcPath, 'utf8')
  const { bytes, symbols } = assemble(src) // default onError: 'exit'
  const ip = typeof symbols.start === 'number' ? symbols.start : 0x0000
  const { steps: ran, mm } = runVm(bytes, steps, ip)
  moveCursorBelowScreen()
  printf('Gero v0.1', ANSI_BOLD, ANSI_BLUE)
  console.log(`Executed ${ran} steps`)

  if (dump) {
    if (dumpRequested && dump.len <= 0) {
      dump.len = Math.max(0, bytes.length)
    }
    console.log('\nHexdump:')
    dumpMemory(mm, dump.start, dump.len)
  }
}

main()
