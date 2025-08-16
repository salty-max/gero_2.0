import { fmt16 } from './util'

export interface Device {
  getUint8: (addr: number) => number
  setUint8: (addr: number, value: number) => void
  getUint16: (addr: number) => number
  setUint16: (addr: number, value: number) => void
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
      throw new Error(`No memory region found for address ${fmt16(addr)}`)
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
}

export default MemoryMapper
