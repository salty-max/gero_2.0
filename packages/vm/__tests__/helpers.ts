import { expect } from 'bun:test'
import CPU from '@gero/vm/cpu'
import { ANSI_BOLD, ANSI_GREY, ANSI_RESET, fmt16 } from '@gero/util/logger'
import type { RegName } from '@gero/vm/register'
import { createMemory } from '@gero/vm/memory'
import { OPCODES } from '@gero/vm/instructions'
import MemoryMapper from '@gero/vm/memory-mapper'

export const hi = (w: number) => (w >>> 8) & 0xff
export const lo = (w: number) => w & 0xff
export const word = (w: number) => [hi(w), lo(w)]

export function makeCPU(size = 256 * 256) {
  const MM = new MemoryMapper()
  const ram = createMemory(size)
  MM.map(ram, 0, size - 1)
  return new CPU(MM)
}

export function loadProgram(cpu: CPU, bytes: number[], start = 0) {
  const mem = cpu.getMemory()

  for (let i = 0; i < mem.byteLength; i++) mem.setUint8(i, 0)

  for (let i = 0; i < bytes.length; i++) {
    const raw = bytes[i]
    if (raw === undefined || raw === null) {
      throw new TypeError(`loadProgram: bytes[${i}] is ${raw}`)
    }
    if (!Number.isInteger(raw)) {
      throw new TypeError(`loadProgram: bytes[${i}] is not an integer: ${raw}`)
    }
    if (raw < 0 || raw > 0xff) {
      throw new RangeError(`loadProgram: bytes[${i}] out of byte range: ${raw}`)
    }
    mem.setUint8(start + i, raw & 0xff)
  }
  cpu.setRegister('ip', start)
}

export function padTo(addr: number, currentLen: number): number[] {
  return Array.from(
    { length: Math.max(0, addr - currentLen) },
    () => OPCODES.NO_OP
  )
}

/**
 * Steps the CPU one instruction.
 * - Quiet on success unless VERBOSE_TEST=1 or { verbose: true } passed
 * - Always logs diff + memory context on failure
 */
export function stepAndShow(
  cpu: CPU,
  label?: string,
  { verbose }: { verbose?: boolean } = {}
) {
  const VERBOSE = verbose || process.env.VERBOSE_TEST === '1'

  try {
    const result = cpu.step?.() ?? (cpu as any).execute?.()

    if (VERBOSE) {
      console.log(cpu.debugDiff({ unchanged: 'hide', label }))
    }

    return result
  } catch (e) {
    // On fail: show diff (with label if provided), then memory context
    console.log(cpu.debugDiff({ unchanged: 'hide', label }))
    console.error(
      `${ANSI_BOLD}${ANSI_GREY}Assertion failed${ANSI_RESET}${
        label ? `: ${label}` : ''
      }`
    )
    const sp = cpu.getRegister('sp')
    cpu.viewMemoryAt(Math.max(0, (sp - 16) & 0xffff), 32)
    throw e
  }
}

export function callFrameAddrs(cpu: CPU) {
  const fp = cpu.getRegister('fp')
  return {
    fp,
    frameSize: fp + 2,
    ra: fp + 4,
    regsBase: fp + 6,
  }
}

export function expectSavedRA(cpu: CPU, expectedRA: number, ctx?: string) {
  const { ra } = callFrameAddrs(cpu)
  expectMem(cpu, ra, expectedRA, ctx ?? `saved RA at ${fmt16(ra)}`)
}

export function expectAfterCallInvariant(cpu: CPU) {
  const sp = cpu.getRegister('sp')
  const fp = cpu.getRegister('fp')
  expect(sp).toBe(fp)
}

export function expectReg(cpu: CPU, reg: RegName, toBe: number, ctx?: string) {
  try {
    const got = cpu.getRegister(reg)
    expect(got).toBe(toBe)
  } catch (e) {
    console.log(
      `${ANSI_BOLD}${ANSI_GREY}Assertion failed${ANSI_RESET}${ctx ? `: ${ctx}` : ''}`
    )
    cpu.debugDiff({
      label: ctx ?? `after expecting ${reg}==${toBe}`,
      unchanged: 'show',
    })
    throw e
  }
}

export function expectMem(cpu: CPU, addr: number, toBe: number, ctx?: string) {
  try {
    const got = cpu.readWord(addr)
    expect(got).toBe(toBe)
  } catch (e) {
    // Show a small memory window centered on addr (clamped at 0)
    const start = Math.max(0, addr - 8)
    console.log(
      `${ANSI_BOLD}${ANSI_GREY}Assertion failed${ANSI_RESET}${
        ctx ? `: ${ctx}` : ''
      }`
    )
    cpu.viewMemoryAt(start, 16)
    throw e
  }
}

export function expectIPDelta(
  cpu: CPU,
  beforeIP: number,
  delta: number,
  ctx?: string
) {
  try {
    const got = cpu.getRegister('ip')
    expect(got).toBe(beforeIP + delta)
  } catch (e) {
    console.log(
      `${ANSI_BOLD}${ANSI_GREY}Assertion failed${ANSI_RESET}${
        ctx ? `: ${ctx}` : ''
      }`
    )
    cpu.debugDiff({
      label: ctx ?? `after expecting ip==0x${(beforeIP + delta).toString(16)}`,
      unchanged: 'hide', // show only changed regs
    })
    throw e
  }
}

export function section(title: string) {
  console.log(`${ANSI_BOLD}${ANSI_GREY}── ${title} ──${ANSI_RESET}`)
}
