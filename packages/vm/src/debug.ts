import type MemoryMapper from './memory-mapper'
import {
  printHexTable,
  toHexTable,
  type HexTableOptions,
} from '@gero/util/hex-table'

export function readBytes(
  mm: MemoryMapper,
  start: number,
  length: number
): number[] {
  const lo = Math.max(0, start | 0)
  const hi = Math.min(mm.byteLength, lo + Math.max(0, length | 0))
  const out: number[] = []
  for (let addr = lo; addr < hi; addr++) out.push(mm.getUint8(addr))
  return out
}

export function toHexDump(
  mm: MemoryMapper,
  start = 0,
  length = 0x100,
  opts: Omit<HexTableOptions, 'startAddress'> = {}
): string {
  const bytes = readBytes(mm, start, length)
  return toHexTable(bytes, { ...opts, startAddress: start, groupEvery: 1 })
}

export function dumpMemory(
  mm: MemoryMapper,
  start = 0,
  length = 0x100,
  opts: Omit<HexTableOptions, 'startAddress'> = {}
) {
  const bytes = readBytes(mm, start, length)
  printHexTable(bytes, { ...opts, startAddress: start, groupEvery: 1 })
}
