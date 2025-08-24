export interface Memory {
  buffer: ArrayBuffer
  byteLength: number
  getUint8: (offset: number, littleEndian?: boolean) => number
  setUint8: (offset: number, value: number, littleEndian?: boolean) => void
  getUint16: (offset: number, littleEndian?: boolean) => number
  setUint16: (offset: number, value: number, littleEndian?: boolean) => void
  /**
   * Returns a mask for [offset, offset+len) where each mask byte is 1 if the
   * corresponding memory byte has been written since creation, otherwise 0.
   * Implementations that don't track writes should return an array of zeros.
   */
  getInitMask?: (offset: number, len: number) => Uint8Array
}

export function createMemory(sizeInBytes: number): Memory {
  const buffer = new ArrayBuffer(sizeInBytes)
  const dv = new DataView(buffer)

  // Track writes with a 1-bit-per-byte bitmap so the UI can distinguish
  // default zeros from program/runtime-initialized bytes.
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

  return {
    buffer,
    byteLength: buffer.byteLength,
    getUint8: dv.getUint8.bind(dv),
    setUint8: (o, v) => {
      dv.setUint8(o, v)
      mark(o)
    },
    getUint16: dv.getUint16.bind(dv),
    setUint16: (o, v) => {
      dv.setUint16(o, v)
      mark(o)
      mark(o + 1)
    },
    getInitMask: getMask,
  }
}
