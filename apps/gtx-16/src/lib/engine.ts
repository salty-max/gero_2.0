import {
  BACKGROUND_OFFSET,
  FOREGROUND_OFFSET,
  FRAME_DURATION,
  MAX_SPRITES,
  SPRITE_SIZE,
  SPRITE_TABLE_OFFSET,
  TILES_X,
  TILES_Y,
} from './constants'
import { Renderer } from './renderer'
import { Tile } from './tile'
import type { VMService } from './vm.service'

const initialInputStates = [0, 0, 0, 0, 0, 0, 0, 0]

export class GtxEngine {
  private renderer: Renderer | null = null
  private vm: VMService | null = null
  private inputStates = initialInputStates.slice()
  private tileCache: Tile[] = []
  private lastTs = performance.now()
  private ticking = false
  private faulted = false
  private rafId: number | null = null

  mount(canvas: HTMLCanvasElement, vm: VMService, cart: string) {
    this.renderer = new Renderer(canvas)
    this.vm = vm

    this.vm.setOnEvent?.((ev) => {
      if (ev.t === 'ready') console.log('VM ready')
      if (ev.t === 'cart:loaded') console.log('Cartridge loaded')
      if (ev.t === 'paused' && ev.reason === 'fault') {
        console.error(`VM faulted at IP=${(ev.ip ?? 0).toString(16)}`)
        this.faulted = true
      }
    })

    this.vm.init()
    this.vm.loadCartridge(cart)

    // cache tiles once
    const tileData = this.vm.getTiles()
    this.tileCache = tileData.map((t) => new Tile(Array.from(t)))

    // level-based input
    const onKeyDown = (e: KeyboardEvent) => {
      const i = this.keyToIndex(e.key)
      if (i >= 0) {
        this.inputStates[i] = 1
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    ;(this as { _onKeyDown?: (e: KeyboardEvent) => void })._onKeyDown =
      onKeyDown
  }

  start(): void {
    if (this.rafId !== null) return
    const loop = () => {
      this.tick()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  resize(): void {
    this.renderer?.clear()
  }

  tick(): void {
    if (this.faulted || this.ticking || !this.vm || !this.renderer) return
    this.ticking = true
    try {
      const now = performance.now()
      const delta = now - this.lastTs
      if (delta < FRAME_DURATION) return
      this.lastTs = now

      this.vm.setInput(Uint8Array.from(this.inputStates))

      for (let i = 0; i < this.inputStates.length; i++) {
        this.inputStates[i] = 0
      }

      // 2) snapshot memory (single frame view)
      const bg = this.vm.peekMany(BACKGROUND_OFFSET, TILES_X * TILES_Y)
      const oam = this.vm.peekMany(
        SPRITE_TABLE_OFFSET,
        MAX_SPRITES * SPRITE_SIZE
      )
      const fg = this.vm.peekMany(FOREGROUND_OFFSET, TILES_X * TILES_Y)

      // 3) draw
      const r = this.renderer

      for (let i = 0; i < bg.length; i++) {
        const x = i % TILES_X
        const y = (i / TILES_X) | 0
        const tid = bg[i]!
        const tile = this.tileCache[tid]
        if (tile) r.drawGridAlignedTile(x, y, tile)
      }

      const end = Math.min(oam.length, MAX_SPRITES * SPRITE_SIZE)
      for (let base = 0; base < end; base += SPRITE_SIZE) {
        const x = (oam[base]! << 8) | (oam[base + 1] ?? 0)
        const y = (oam[base + 2]! << 8) | (oam[base + 3] ?? 0)
        const tileIdx = oam[base + 4] ?? 0
        const animIdx = oam[base + 5] ?? 0
        const tile = this.tileCache[tileIdx + animIdx]
        if (tile) r.drawPixelAlignedTile(x, y, tile)
      }

      for (let i = 0; i < fg.length; i++) {
        const x = i % TILES_X
        const y = (i / TILES_X) | 0
        const tid = fg[i]!
        const tile = this.tileCache[tid]
        if (tile) r.drawGridAlignedTile(x, y, tile)
      }

      // 4) frame IRQ then run until yield
      this.vm.interrupt(1)
      const continued = this.vm.run()
      if (continued === false) this.faulted = true
    } finally {
      this.ticking = false
    }
  }

  unmount(): void {
    try {
      const listener = (this as { _onKeyDown?: (e: KeyboardEvent) => void })
        ._onKeyDown
      if (listener) {
        document.removeEventListener('keydown', listener)
      }
    } catch {
      console.error('Failed to remove keydown listener')
    }
    try {
      this.vm?.pause()
    } catch {
      console.error('Failed to pause VM')
    }
    this.stop()
    this.renderer = null
    this.vm = null
    this.tileCache = []
  }

  private keyToIndex(key: string): number {
    switch (key.toLowerCase()) {
      case 'arrowup':
        return 0
      case 'arrowdown':
        return 1
      case 'arrowleft':
        return 2
      case 'arrowright':
        return 3
      case 'z':
        return 4 // A
      case 'x':
        return 5 // B
      case 'shift':
        return 6 // SELECT
      case 'enter':
        return 7 // START
      default:
        return -1
    }
  }
}
