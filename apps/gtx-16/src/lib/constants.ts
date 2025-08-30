export const TILE_WIDTH = 30
export const TILE_HEIGHT = 14
export const PIXELS_PER_TILE = 8
export const SCREEN_WIDTH = TILE_WIDTH * PIXELS_PER_TILE
export const SCREEN_HEIGHT = TILE_HEIGHT * PIXELS_PER_TILE
export const SCALE_FACTOR = 4

export const TILE_MEMORY_SIZE = 0x2000
export const RAM1_SIZE = 0x20 + 0x200 + 0x200 + 0x200
export const INPUT_SIZE = 0x8
export const RAM2_SIZE = 0x10000 - (TILE_MEMORY_SIZE + RAM1_SIZE + INPUT_SIZE)

export const BACKGROUND_OFFSET = 0x2220
export const FOREGROUND_OFFSET = 0x2420
export const SPRITE_TABLE_OFFSET = 0x2020
export const INPUT_OFFSET = 0x2620
export const PROGRAM_OFFSET = 0x2670
export const INTERRUPT_VECTOR_OFFSET = 0x2000

export const TILES_X = 32
export const TILES_Y = 16
export const MAX_SPRITES = 32
export const SPRITE_SIZE = 16

export const FPS_TARGET = 30
export const FRAME_DURATION = 1000 / FPS_TARGET // in ms
export const CYCLES_PER_FRAME = 200
