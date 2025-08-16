export interface Memory {
  buffer: ArrayBuffer
  byteLength: number
  getUint8: (offset: number, littleEndian?: boolean) => number
  setUint8: (offset: number, value: number, littleEndian?: boolean) => void
  getUint16: (offset: number, littleEndian?: boolean) => number
  setUint16: (offset: number, value: number, littleEndian?: boolean) => void
}

export function createMemory(sizeInBytes: number): Memory {
  const buffer = new ArrayBuffer(sizeInBytes)
  const dv = new DataView(buffer)

  return {
    buffer,
    byteLength: buffer.byteLength,
    getUint8: dv.getUint8.bind(dv),
    setUint8: dv.setUint8.bind(dv),
    getUint16: dv.getUint16.bind(dv),
    setUint16: dv.setUint16.bind(dv),
  }
}
