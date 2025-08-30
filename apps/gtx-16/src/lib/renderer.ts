import { toRgbaIndex } from './colors'
import {
  PIXELS_PER_TILE,
  SCALE_FACTOR,
  TILE_HEIGHT,
  TILE_WIDTH,
} from './constants'
import type { Tile } from './tile'

export class Renderer {
  private _ctx: CanvasRenderingContext2D
  private _width: number = TILE_WIDTH * PIXELS_PER_TILE * SCALE_FACTOR
  private _height: number = TILE_HEIGHT * PIXELS_PER_TILE * SCALE_FACTOR

  get width() {
    return this._width
  }

  get height() {
    return this._height
  }

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')
    this._ctx = ctx
  }

  drawGridAlignedTile(tx: number, ty: number, tile: Tile) {
    this._ctx.drawImage(tile.canvas, tx * tile.width, ty * tile.height)
  }

  drawPixelAlignedTile(px: number, py: number, tile: Tile) {
    this._ctx.drawImage(tile.canvas, px * SCALE_FACTOR, py * SCALE_FACTOR)
  }

  clear() {
    this.color(0)
    this._ctx.fillRect(0, 0, this._width, this._height)
  }

  private color(idx: number) {
    this._ctx.fillStyle = toRgbaIndex(idx)
  }
}
