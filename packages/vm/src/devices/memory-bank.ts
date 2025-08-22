import type { Device } from '../memory-mapper'
import { fmt16 } from '@gero/util'
import { VmError, VmErrorCode } from '../errors'

interface MemoryBankDevice extends Device {}

export const BANK_SIZE = 0x100 // 256 bytes
export const BANK_COUNT = 8

export type BankIndexFn = () => number

export function createBankedMemory(
  n: number,
  bankSize: number,
  getBank: BankIndexFn
): MemoryBankDevice {
  if (n <= 0)
    throw new VmError(VmErrorCode.DEVICE_CONFIG, 'Bank count must be > 0')
  if (bankSize <= 0)
    throw new VmError(VmErrorCode.DEVICE_CONFIG, 'Bank size must be > 0')
  const buffers = Array.from({ length: n }, () => new ArrayBuffer(bankSize))
  const views = buffers.map((ab) => new DataView(ab))

  function normBank(): number {
    let idx = getBank() | 0
    if (idx < 0) idx = ((idx % n) + n) % n
    return idx % n
  }

  function view(): DataView {
    const v = views[normBank()]
    if (!v)
      throw new VmError(
        VmErrorCode.DEVICE_CONFIG,
        'Selected memory does not exist'
      )
    return v
  }

  function checkAddr(addr: number) {
    if ((addr | 0) !== addr || addr < 0 || addr >= bankSize) {
      throw new VmError(
        VmErrorCode.MEM_OUT_OF_RANGE,
        `Address ${fmt16(addr)} out of range 0..${bankSize - 1}`,
        { addr, width: 1, bankSize }
      )
    }
  }

  function getUint8(addr: number): number {
    checkAddr(addr)
    return view().getUint8(addr)
  }

  function setUint8(addr: number, value: number) {
    checkAddr(addr)
    view().setUint8(addr, value & 0xff)
  }

  function getUint16(addr: number): number {
    checkAddr(addr)
    const a1 = (addr + 1) % bankSize
    const hi = getUint8(addr)
    const lo = getUint8(a1)
    return (hi << 8) | lo
  }

  function setUint16(addr: number, value: number) {
    checkAddr(addr)
    const a1 = (addr + 1) % bankSize
    const v = value & 0xffff
    const hi = (v >>> 8) & 0xff
    const lo = v & 0xff
    setUint8(addr, hi)
    setUint8(a1, lo)
  }

  return { getUint8, setUint8, getUint16, setUint16 }
}
