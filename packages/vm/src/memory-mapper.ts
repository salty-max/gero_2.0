import { fmt16 } from '@gero/util'

import { VmError, VmErrorCode } from './errors'

export interface Device {
  getUint8: (addr: number) => number
  setUint8: (addr: number, value: number) => void
  getUint16: (addr: number) => number
  setUint16: (addr: number, value: number) => void
  // Optional: write-tracking mask for UI/diagnostics
  getInitMask?: (addr: number, len: number) => Uint8Array
}

interface Region {
  device: Device
  start: number
  end: number
  remap: boolean
}

class MemoryMapper {
  private regions: Region[]

  get byteLength(): number {
    if (this.regions.length === 0) return 0
    return Math.max(...this.regions.map((r) => r.end)) + 1
  }

  constructor() {
    this.regions = []
  }

  map(device: Device, start: number, end: number, remap = true) {
    const region = {
      device,
      start,
      end,
      remap,
    }
    this.regions.unshift(region)

    return () => {
      this.regions = this.regions.filter((r) => r !== region)
    }
  }

  findRegion(addr: number) {
    let region = this.regions.find((r) => addr >= r.start && addr <= r.end)
    if (!region) {
      throw new VmError(
        VmErrorCode.UNMAPPED_REGION,
        `No memory region found for address ${fmt16(addr)}`,
        { addr }
      )
    }

    return region
  }

  private toDeviceAddr(region: Region, addr: number): number {
    return region.remap ? addr - region.start : addr
  }

  getUint8(addr: number): number {
    const region = this.findRegion(addr)
    const devAddr = this.toDeviceAddr(region, addr)
    return region.device.getUint8(devAddr)
  }

  setUint8(addr: number, value: number): void {
    const region = this.findRegion(addr)
    const devAddr = this.toDeviceAddr(region, addr)
    region.device.setUint8(devAddr, value & 0xff)
  }

  getUint16(addr: number) {
    const region = this.findRegion(addr)
    const devAddr = this.toDeviceAddr(region, addr)
    return region.device.getUint16(devAddr)
  }

  setUint16(addr: number, value: number): void {
    const region = this.findRegion(addr)
    const devAddr = this.toDeviceAddr(region, addr)
    region.device.setUint16(devAddr, value)
  }

  /**
   * Returns a per-byte mask (0/1) for [addr, addr+len) indicating whether
   * those addresses have been written since device creation. For devices
   * without tracking support, returns zeros.
   */
  getInitMask(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(Math.max(0, len | 0))
    for (let i = 0; i < out.length; i++) {
      const a = addr + i
      const region = this.findRegion(a)
      const devAddr = this.toDeviceAddr(region, a)
      const d = region.device
      if (typeof d.getInitMask === 'function') {
        const m = d.getInitMask(devAddr, 1)
        out[i] = m[0] ?? 0
      } else {
        out[i] = 0
      }
    }
    return out
  }
}

export default MemoryMapper
