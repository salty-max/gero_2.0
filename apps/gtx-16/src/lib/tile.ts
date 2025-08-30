import { toRgbaIndex } from './colors'
import { PIXELS_PER_TILE, SCALE_FACTOR } from './constants'
import type { SmoothingCtx } from './types'

export class Tile {
  private _canvas: HTMLCanvasElement
  private _ctx: CanvasRenderingContext2D
  private _width: number
  private _height: number

  get canvas() {
    return this._canvas
  }
  get ctx() {
    return this._ctx
  }
  get width() {
    return this._width
  }
  get height() {
    return this._height
  }

  constructor(data: number[]) {
    this._canvas = document.createElement('canvas')
    const ctx = this._canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')
    this._ctx = ctx

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    this._width = PIXELS_PER_TILE * SCALE_FACTOR * dpr
    this._canvas.width = this._width
    this._height = PIXELS_PER_TILE * SCALE_FACTOR * dpr
    this._canvas.height = this._height

    const sc = ctx as SmoothingCtx
    sc.imageSmoothingEnabled = false
    sc.webkitImageSmoothingEnabled = false
    sc.mozImageSmoothingEnabled = false
    sc.msImageSmoothingEnabled = false

    this.draw(0, 0, data)
  }

  private draw(x: number, y: number, tileData: number[]) {
    for (let oy = 0; oy < PIXELS_PER_TILE; oy++) {
      for (let ox = 0; ox < PIXELS_PER_TILE; ox += 2) {
        const idx = (oy * PIXELS_PER_TILE + ox) / 2
        if (tileData[idx] === undefined) continue

        const byte = tileData[idx]
        const c1 = (byte >>> 4) & 0xf
        const c2 = byte & 0xf

        this.drawPixel(x + ox, y + oy, c1)
        this.drawPixel(x + ox + 1, y + oy, c2)
      }
    }
  }

  private drawPixel(x: number, y: number, c: number) {
    this.color(c)
    this._ctx.fillRect(
      x * SCALE_FACTOR,
      y * SCALE_FACTOR,
      SCALE_FACTOR,
      SCALE_FACTOR
    )
  }

  private color(idx: number) {
    this._ctx.fillStyle = toRgbaIndex(idx)
  }
}
