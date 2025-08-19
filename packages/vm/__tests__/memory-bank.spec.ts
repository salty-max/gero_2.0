import { describe, it, expect } from 'bun:test'
import {
  createBankedMemory,
  BANK_SIZE,
  BANK_COUNT,
} from '@gero/vm/devices/memory-bank'
import type { Device } from '@gero/vm/memory-mapper'

// small helper to create a banked device with a mutable bank “register”
function mkMem(
  n = BANK_COUNT,
  size = BANK_SIZE,
  initial = 0
): { mem: Device; setBank: (v: number) => void } {
  let bankReg = initial
  const mem = createBankedMemory(n, size, () => bankReg)
  return { mem, setBank: (v) => (bankReg = v) }
}

describe('Memory bank', () => {
  it('reads/writes 8-bit in the active bank only', () => {
    const { mem, setBank } = mkMem(2, 0x100, 0)

    setBank(0)
    mem.setUint8(0x10, 0xaa)
    expect(mem.getUint8(0x10)).toBe(0xaa)

    setBank(1)
    expect(mem.getUint8(0x10)).toBe(0x00) // isolated
    mem.setUint8(0x10, 0xbb)
    expect(mem.getUint8(0x10)).toBe(0xbb)

    setBank(0)
    expect(mem.getUint8(0x10)).toBe(0xaa)
  })

  it('reads/writes 16-bit big-endian', () => {
    const { mem } = mkMem(1, 0x100, 0)

    mem.setUint16(0x20, 0xbeef) // hi at 0x20, lo at 0x21
    expect(mem.getUint8(0x20)).toBe(0xbe)
    expect(mem.getUint8(0x21)).toBe(0xef)
    expect(mem.getUint16(0x20)).toBe(0xbeef)
  })

  it('wraps 16-bit at the bank boundary', () => {
    const { mem } = mkMem(1, 0x100, 0)

    // write across the edge: hi at 0xFF, lo at 0x00
    mem.setUint16(0xff, 0xbeef)
    expect(mem.getUint8(0xff)).toBe(0xbe)
    expect(mem.getUint8(0x00)).toBe(0xef)
    expect(mem.getUint16(0xff)).toBe(0xbeef)

    // read across the edge after writing bytes
    mem.setUint8(0xff, 0x12)
    mem.setUint8(0x00, 0x34)
    expect(mem.getUint16(0xff)).toBe(0x1234)
  })

  it('normalizes bank index (negative and overflow)', () => {
    const { mem, setBank } = mkMem(4, 0x20, 0)

    // bank 0
    mem.setUint8(0x01, 0x11)

    // bank -1 -> wraps to bank 3
    setBank(-1)
    expect(mem.getUint8(0x01)).toBe(0x00)
    mem.setUint8(0x01, 0x22)

    // large positive -> 5 % 4 = 1 (not our banks above)
    setBank(5)
    expect(mem.getUint8(0x01)).toBe(0x00)

    // back to bank 3 via equivalent positive index
    setBank(3)
    expect(mem.getUint8(0x01)).toBe(0x22)

    // back to bank 0
    setBank(0)
    expect(mem.getUint8(0x01)).toBe(0x11)
  })

  it('throws RangeError on out-of-range addresses (8-bit)', () => {
    const { mem } = mkMem(1, 0x10, 0) // 16-byte bank

    expect(() => mem.getUint8(-1)).toThrow(RangeError)
    expect(() => mem.setUint8(-1, 0)).toThrow(RangeError)
    expect(() => mem.getUint8(0x10)).toThrow(RangeError) // == size
    expect(() => mem.setUint8(0x10, 0)).toThrow(RangeError)
  })

  it('throws RangeError on out-of-range addresses (16-bit start)', () => {
    const { mem } = mkMem(1, 0x10, 0) // 16-byte bank

    // start out of range
    expect(() => mem.getUint16(0x10)).toThrow(RangeError)
    expect(() => mem.setUint16(0x10, 0x1234)).toThrow(RangeError)

    // NOTE: set/get at 0x0F are valid because the implementation wraps
    // lo byte to 0x00; so these should NOT throw:
    expect(() => mem.setUint16(0x0f, 0xabcd)).not.toThrow()
    expect(mem.getUint16(0x0f)).toBe(0xabcd)
  })

  it('does not accidentally mix banks when toggling during ops', () => {
    const { mem, setBank } = mkMem(2, 0x100, 0)

    setBank(0)
    mem.setUint16(0x40, 0xcafe)
    setBank(1)
    mem.setUint16(0x40, 0xbeef)

    setBank(0)
    expect(mem.getUint16(0x40)).toBe(0xcafe)
    setBank(1)
    expect(mem.getUint16(0x40)).toBe(0xbeef)
  })
})
