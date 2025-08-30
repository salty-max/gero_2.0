import { assemble } from '@gero/asm'
import type { Memory } from '@gero/vm'
import { CPU, createRAM, createROM, MemoryMapper } from '@gero/vm'

import {
  BACKGROUND_OFFSET,
  FOREGROUND_OFFSET,
  INPUT_SIZE,
  INTERRUPT_VECTOR_OFFSET,
  RAM1_SIZE,
  RAM2_SIZE,
  TILE_MEMORY_SIZE,
  CYCLES_PER_FRAME,
  PROGRAM_OFFSET,
} from './constants'

export type VmEv =
  | { t: 'ready' }
  | { t: 'tick'; ip: number }
  | { t: 'paused'; reason: 'manual' | 'halt' | 'fault'; ip: number }
  | { t: 'cart:loaded' }

export class VMService {
  private cpu: CPU | null = null
  private mm: MemoryMapper | null = null
  private onEvent: ((ev: VmEv) => void) | null = null
  private tileMemory: Memory | null = null
  private inputMemory: Memory | null = null
  private faulted = false

  get tiles(): Memory | null {
    return this.tileMemory
  }

  setOnEvent(cb: (ev: VmEv) => void) {
    this.onEvent = cb
  }

  private post(ev: VmEv) {
    if (this.onEvent) this.onEvent(ev)
  }

  init() {
    const tileMemory = createROM(TILE_MEMORY_SIZE)
    const RAMSegment1 = createRAM(RAM1_SIZE)
    const inputMemory = createROM(INPUT_SIZE)
    const RAMSegment2 = createRAM(RAM2_SIZE)
    this.mm = new MemoryMapper()
    this.mm.map(tileMemory, 0x0000, TILE_MEMORY_SIZE)
    this.mm.map(RAMSegment1, 0x2000, RAM1_SIZE)
    this.mm.map(inputMemory, 0x2620, INPUT_SIZE)
    this.mm.map(RAMSegment2, 0x2628, RAM2_SIZE)

    this.tileMemory = tileMemory
    this.inputMemory = inputMemory
    this.cpu = new CPU(this.mm, INTERRUPT_VECTOR_OFFSET)
    this.post({ t: 'ready' })
  }

  run(): boolean {
    if (!this.cpu) return false
    if (this.faulted) return false
    for (let i = 0; i < CYCLES_PER_FRAME; i++) {
      const res = this.cpu.tryStep()
      if (!res.ok) {
        this.post({ t: 'paused', reason: 'fault', ip: res.ip })
        this.faulted = true
        console.error('VM fault:', res.error)
        return false
      }
      if (res.halted) {
        this.post({
          t: 'paused',
          reason: 'halt',
          ip: this.cpu.getRegister('ip'),
        })
        return false
      }
    }

    this.post({ t: 'tick', ip: this.cpu.getRegister('ip') })
    return true
  }

  pause() {
    if (this.cpu)
      this.post({
        t: 'paused',
        reason: 'manual',
        ip: this.cpu.getRegister('ip'),
      })
  }

  /**
   * Load a text-based cartridge with sections for CODE, GFX (tiles), BG, FG.
   * Marker format: lines exactly like `--- CODE ---`, `--- GFX ---`, `--- BG ---`, `--- FG ---` (case-insensitive).
   * Other lines before the first marker are ignored.
   */
  loadCartridge(text: string) {
    // Ensure VM is initialized
    if (!this.mm || !this.cpu) this.init()
    if (!this.mm || !this.cpu) return

    const buckets: Record<'code' | 'gfx' | 'bg' | 'fg', string[]> = {
      code: [],
      gfx: [],
      bg: [],
      fg: [],
    }
    let section: 'code' | 'gfx' | 'bg' | 'fg' | null = null
    const marker = /^---\s*(CODE|GFX|BG|FG)\s*---\s*$/i
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trimEnd()
      const m = marker.exec(line)
      if (m) {
        section = (
          m[1]?.toUpperCase() as 'CODE' | 'GFX' | 'BG' | 'FG'
        ).toLowerCase() as 'code' | 'gfx' | 'bg' | 'fg'
        continue
      }
      if (section) buckets[section].push(line)
    }

    // --- helpers --------------------------------------------------------------
    const parseHexBytes = (lines: string[]): Uint8Array => {
      const hex = lines.join('\n').match(/\b[0-9a-fA-F]{2}\b/g) ?? []
      return Uint8Array.from(hex.map((h) => parseInt(h, 16) & 0xff))
    }

    const writeSequential = (base: number, data: Uint8Array, max: number) => {
      const n = Math.min(data.length, max)
      for (let i = 0; i < n; i++) this.mm?.setUint8(base + i, data[i]!)
      // zero-fill remainder if data short
      for (let i = n; i < max; i++) this.mm?.setUint8(base + i, 0)
      if (data.length > max) {
        console.warn(
          `GTX-16: data overflow at 0x${base.toString(16)} (kept ${max} of ${data.length} bytes)`
        )
      }
    }
    // --------------------------------------------------------------------------

    // Assemble and load code into ROM region
    const asmSource = buckets.code.join('\n')
    if (asmSource.trim().length) {
      const { bytes, symbols, diags } = assemble(asmSource, PROGRAM_OFFSET)
      if (!diags.errors.length) {
        bytes.forEach((b, i) => this.mm?.setUint8(PROGRAM_OFFSET + i, b))
        this.mm?.setUint16(INTERRUPT_VECTOR_OFFSET, PROGRAM_OFFSET)
        if (!('after_frame' in symbols))
          throw new Error("No 'after_frame' label in code")
        this.mm?.setUint16(INTERRUPT_VECTOR_OFFSET + 2, symbols.after_frame)
        this.cpu?.setRegister('ip', symbols.start ?? PROGRAM_OFFSET)
      }
    }

    // GFX: raw hex bytes, truncated to multiple of 32 (tile bytes)
    if (buckets.gfx.length) {
      const bytes = parseHexBytes(buckets.gfx)
      const tileBytes = bytes.subarray(0, bytes.length - (bytes.length % 32))
      this.tileMemory?.load(tileBytes) // assumes this writes starting at 0x0000
    }

    // BG/FG: raw hex bytes, sequential into their 512-byte windows
    if (buckets.bg.length) {
      const bg = parseHexBytes(buckets.bg)
      writeSequential(BACKGROUND_OFFSET, bg, 0x200)
    }
    if (buckets.fg.length) {
      const fg = parseHexBytes(buckets.fg)
      writeSequential(FOREGROUND_OFFSET, fg, 0x200)
    }

    this.post({ t: 'cart:loaded' })
  }

  peekByte(addr: number): number {
    if (!this.mm) return 0
    const v = this.mm.getUint8(addr)
    return v
  }

  peekWord(addr: number): number {
    if (!this.mm) return 0
    return this.mm.getUint16(addr)
  }

  peekMany(addr: number, len: number): Uint8Array {
    if (!this.mm) return new Uint8Array(0)
    const a0 = (addr | 0) & 0xffff
    const n = Math.max(0, len | 0)
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i++) out[i] = this.mm.getUint8((a0 + i) & 0xffff)
    return out
  }

  interrupt(v: number) {
    if (!this.cpu) return
    this.cpu.handleInterrupt(v)
  }

  setInput(states: Uint8Array) {
    this.inputMemory?.load(states.slice(0, INPUT_SIZE))
  }

  getTile(offset: number) {
    const tile = this.tileMemory?.slice(offset, offset + 32)
    if (tile === undefined) throw new Error('Tile memory not available')
    return tile
  }

  getTiles() {
    const tiles: Uint8Array[] = []
    if (!this.tileMemory) return tiles
    for (let i = 0; i < TILE_MEMORY_SIZE; i += 32) {
      const t = this.tileMemory.slice(i, i + 32)
      tiles.push(t)
    }
    return tiles
  }
}
