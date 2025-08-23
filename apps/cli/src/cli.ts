#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { assemble } from '@gero/asm'
import {
  ANSI_BOLD,
  ANSI_CYAN,
  ANSI_GREY,
  ANSI_RED,
  ANSI_RESET,
  printf,
} from '@gero/util'
import { CPU, dumpMemory } from '@gero/vm'
import { createScreenDevice } from '@gero/vm/devices/screen-device'
import { createMemory } from '@gero/vm/memory'
import MemoryMapper from '@gero/vm/memory-mapper'

function usage(): never {
  console.log(
    'Usage: bun run apps/cli/src/cli.ts <program.asm> [--steps N] [--sleep MS] [--splash-delay MS] [--dump [START[:LEN]]]\n' +
      '  --steps N            Run at most N instructions (default: 1000)\n' +
      '  --sleep MS           Yield between steps (default: 0)\n' +
      '  --splash-delay MS    Delay before VM starts (default: 300)\n' +
      '  --dump [S[:L]]       Hexdump memory after run (default: 0:256)'
  )
  process.exit(1)
}

async function runVm(
  bytes: number[],
  maxSteps = 1000,
  startIp = 0x0000,
  sleepMs = 0
) {
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
    if (sleepMs > 0) {
      // Yield to the event loop so screen updates render progressively
      // @ts-ignore Bun global sleep
      await Bun.sleep(sleepMs)
    }
  }
  return { steps, mm: MM }
}

function moveCursorBelowScreen() {
  try {
    // Reset attributes and move cursor to row 18, col 1 (below 16x16 screen)
    process.stdout.write('\x1b[0m\x1b[18;1H')
  } catch {}
}

function printSplash(opts: {
  romPath: string
  romBytes: number
  entryIp: number
  maxSteps: number
  sleepMs: number
}) {
  const title = `${ANSI_BOLD}${ANSI_RED}GRX${ANSI_RESET}${ANSI_BOLD}-16${ANSI_RESET}`
  const sub = `${ANSI_GREY}Fantasy console • VM: ${ANSI_CYAN}Gero v0.1${ANSI_RESET}`
  const rom = `${ANSI_GREY}ROM:${ANSI_RESET} ${basename(opts.romPath)} ${ANSI_GREY}(${opts.romBytes} bytes)${ANSI_RESET}`
  const run = `${ANSI_GREY}Entry:${ANSI_RESET} 0x${opts.entryIp
    .toString(16)
    .padStart(4, '0')}   ${ANSI_GREY}Steps:${ANSI_RESET} ${opts.maxSteps}   ${
    opts.sleepMs > 0
      ? `${ANSI_GREY}Sleep:${ANSI_RESET} ${opts.sleepMs}ms`
      : `${ANSI_GREY}Sleep:${ANSI_RESET} off`
  }`

  const width = 52
  const line = (ch: string) => ch.repeat(width - 2)
  const pad = (s: string) => {
    const plain = s.replace(/\x1b\[[0-9;]*m/g, '')
    const padLen = Math.max(0, width - 4 - plain.length)
    return s + ' '.repeat(padLen)
  }

  // Clear and draw header box at the top
  process.stdout.write('\x1b[2J\x1b[H')
  console.log(`${ANSI_GREY}┌${line('─')}┐${ANSI_RESET}`)
  console.log(
    `${ANSI_GREY}│${ANSI_RESET} ${pad(title)} ${ANSI_GREY}│${ANSI_RESET}`
  )
  console.log(
    `${ANSI_GREY}│${ANSI_RESET} ${pad(sub)} ${ANSI_GREY}│${ANSI_RESET}`
  )
  console.log(`${ANSI_GREY}├${line('─')}┤${ANSI_RESET}`)
  console.log(
    `${ANSI_GREY}│${ANSI_RESET} ${pad(rom)} ${ANSI_GREY}│${ANSI_RESET}`
  )
  console.log(
    `${ANSI_GREY}│${ANSI_RESET} ${pad(run)} ${ANSI_GREY}│${ANSI_RESET}`
  )
  console.log(`${ANSI_GREY}└${line('─')}┘${ANSI_RESET}`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 1) usage()

  let file = ''
  let steps = 1000
  let dump: { start: number; len: number } | null = null
  let dumpRequested = false
  let sleepMs = 0
  let splashDelay = 300
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--steps') {
      const n = Number(args[++i])
      if (!Number.isFinite(n) || n <= 0) usage()
      steps = Math.floor(n)
    } else if (a === '--sleep') {
      const n = Number(args[++i])
      if (!Number.isFinite(n) || n < 0) usage()
      sleepMs = Math.floor(n)
    } else if (a === '--splash-delay') {
      const n = Number(args[++i])
      if (!Number.isFinite(n) || n < 0) usage()
      splashDelay = Math.floor(n)
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

  // Splash header
  printSplash({
    romPath: srcPath,
    romBytes: bytes.length,
    entryIp: ip,
    maxSteps: steps,
    sleepMs,
  })

  // Small delay so the splash is visible before rendering or stepping
  if (splashDelay > 0) {
    try {
      // @ts-ignore Bun global sleep (if available)
      await Bun.sleep(splashDelay)
    } catch {
      await new Promise((r) => setTimeout(r, splashDelay))
    }
  }

  const { steps: ran, mm } = await runVm(bytes, steps, ip, sleepMs)
  moveCursorBelowScreen()
  printf('GRX-16', ANSI_BOLD, ANSI_RED)
  console.log(
    `${ANSI_GREY}Executed${ANSI_RESET} ${ran} ${ANSI_GREY}steps${ANSI_RESET}`
  )

  if (dump) {
    if (dumpRequested && dump.len <= 0) {
      dump.len = Math.max(0, bytes.length)
    }
    console.log('\nHexdump:')
    dumpMemory(mm, dump.start, dump.len)
    console.log(bytes.join(' '))
  }
}

main()
