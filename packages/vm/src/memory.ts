export interface BaseMemory {
  buffer: ArrayBuffer
  byteLength: number
  getUint8: (offset: number, littleEndian?: boolean) => number
  getUint16: (offset: number, littleEndian?: boolean) => number
  /**
   * Returns a mask for [offset, offset+len) where each mask byte is 1 if the
   * corresponding memory byte has been written since creation, otherwise 0.
   * Implementations that don't track writes should return an array of zeros.
   */
  getInitMask?: (offset: number, len: number) => Uint8Array
  /** Emulator-only initialization that writes bytes without affecting write mask */
  load: (data: Uint8Array, offset?: number) => void
  /** Copy-out of a contiguous subrange */
  slice: (start: number, end: number) => Uint8Array
}

export interface RAMMemory extends BaseMemory {
  setUint8: (offset: number, value: number, littleEndian?: boolean) => void
  setUint16: (offset: number, value: number, littleEndian?: boolean) => void
}

export interface ROMMemory extends BaseMemory {
  setUint8: (offset: number, value: number, littleEndian?: boolean) => 0
  setUint16: (offset: number, value: number, littleEndian?: boolean) => 0
}

export type Memory = RAMMemory | ROMMemory

function makeMask(sizeInBytes: number) {
  const mask = new Uint8Array(Math.ceil(sizeInBytes / 8))
  const mark = (off: number) => {
    if (off < 0 || off >= sizeInBytes) return
    const i = (off / 8) | 0
    const b = off % 8
    mask[i] = mask[i]! | (1 << b)
  }
  const getMask = (offset: number, len: number) => {
    const n = Math.max(0, len | 0)
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      const off = offset + i
      if (off < 0 || off >= sizeInBytes) continue
      const byte = (off / 8) | 0
      const bit = off % 8
      out[i] = (mask[byte]! & (1 << bit)) !== 0 ? 1 : 0
    }
    return out
  }
  return { mark, getMask }
}

export function createRAM(sizeInBytes: number): RAMMemory {
  const buffer = new ArrayBuffer(sizeInBytes)
  const dv = new DataView(buffer)
  const u8 = new Uint8Array(buffer)
  const { mark, getMask } = makeMask(sizeInBytes)

  return {
    buffer,
    byteLength: buffer.byteLength,
    getUint8: dv.getUint8.bind(dv),
    getUint16: dv.getUint16.bind(dv),
    setUint8: (o, v) => {
      dv.setUint8(o, v)
      mark(o)
    },
    setUint16: (o, v) => {
      dv.setUint16(o, v)
      mark(o)
      mark(o + 1)
    },
    getInitMask: getMask,
    load: (data) => {
      data.forEach((b, i) => dv.setUint8(i, b))
    },
    slice: (start, end) => {
      return u8.slice(start, end)
    },
  }
}

export function createROM(sizeInBytes: number): ROMMemory {
  const buffer = new ArrayBuffer(sizeInBytes)
  const dv = new DataView(buffer)
  const u8 = new Uint8Array(buffer)
  const { getMask } = makeMask(sizeInBytes)

  return {
    buffer,
    byteLength: buffer.byteLength,
    getUint8: dv.getUint8.bind(dv),
    getUint16: dv.getUint16.bind(dv),
    // Writes are ignored for ROM
    setUint8: () => 0,
    setUint16: () => 0,
    getInitMask: getMask, // remains zeros
    load: (data) => {
      data.forEach((b, i) => dv.setUint8(i, b))
    },
    slice: (start, end) => {
      return u8.slice(start, end)
    },
  }
}
