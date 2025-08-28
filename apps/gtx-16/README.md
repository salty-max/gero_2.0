# GTX-16 Specs

This document is the authoritative spec for the GTX‑16 fantasy console built on the Gero VM.

## Screen

- Resolution: 240×112 pixels
- Color depth: 4 bits per pixel (16 colors)
- Tile size: 8×8 pixels (32 bytes per tile)
- Tilemap visible area: 30×14 tile indices (240×112)
- Max sprites: 32

### Pixel encoding (tile memory)

- 2 pixels per byte: high nibble = left pixel, low nibble = right pixel.
- Each nibble is a palette index 0..15. Index 0 is transparent.
- One tile = 8×8 pixels = 64 pixels = 32 bytes. Each row uses 4 bytes.

### Tilemaps (BG/FG)

- Memory regions are 512 bytes each and are interpreted as a 32×16 index grid (1 byte per entry).
- The visible window is 30×14; the extra 2×2 tiles form an offscreen guard band to support pixel scrolling.
- Entry format: 1 byte tile index (0..255). No per‑tile flags are defined currently.

### Composition order

1. Background tilemap (BG)
2. Sprites (color index 0 transparent)
3. Foreground tilemap (FG)

## Memory Map

| Address Range | Size      | Description                    |
| ------------- | --------- | ------------------------------ |
| 0x0000–0x1FFF | 8 KB      | Tile Memory (256 tiles × 32 B) |
| 0x2000–0x201F | 32 Bytes  | Interrupt Vector Table         |
| 0x2020–0x221F | 512 Bytes | Sprite Table (32 × 16 B)       |
| 0x2220–0x241F | 512 Bytes | Background Tilemap (32×16)     |
| 0x2420–0x261F | 512 Bytes | Foreground Tilemap (32×16)     |
| 0x2620–0x2627 | 8 Bytes   | Input (8‑button map)           |
| 0x2628–0x262F | 8 Bytes   | Unreserved                     |
| 0x2630–0x266F | 64 Bytes  | Global flags and registers     |
| 0x2670–0xFFFF | 57.5 KB   | ROM (Program + Data)           |

### Global registers (proposed addresses)

All multi‑byte registers are big‑endian, unsigned 16‑bit.

| Address | Name | Type | Description              |
| ------- | ---- | ---- | ------------------------ |
| 0x2630  | BG_X | u16  | BG X pixel offset (0–16) |
| 0x2632  | BG_Y | u16  | BG Y pixel offset (0–16) |
| 0x2634  | FG_X | u16  | FG X pixel offset (0–16) |
| 0x2636  | FG_Y | u16  | FG Y pixel offset (0–16) |

## Sprite Table

Each sprite occupies 16 bytes at 0x2020 + 16×index.

| Offset | Size | Name            | Description                            |
| ------ | ---- | --------------- | -------------------------------------- |
| 0      | 2    | X               | X position (u16, big‑endian, pixels)   |
| 2      | 2    | Y               | Y position (u16, big‑endian, pixels)   |
| 4      | 1    | Tile Index      | Tile ID (0..255)                       |
| 5      | 1    | Animation Index | Optional animation frame index         |
| 6      | 1    | Blend Mode      | Reserved for palette/priority/blending |
| 7      | 9    | Attributes      | Reserved (collision, flip H/V, etc.)   |

Notes:

- The last 9 bytes are intentionally left undefined; ROM authors may use them for collision, flipping, priority, palette bank, etc. The runtime does not interpret them until defined.

## Inputs

The console exposes a classic 8‑button layout mapped to 0x2620:

| Address       | Bits      | Description               |
| ------------- | --------- | ------------------------- |
| 0x2620        | 0: Up     | 1 = pressed, 0 = released |
|               | 1: Down   |                           |
|               | 2: Left   |                           |
|               | 3: Right  |                           |
|               | 4: A      |                           |
|               | 5: B      |                           |
|               | 6: Start  |                           |
|               | 7: Select |                           |
| 0x2621–0x2627 | —         | Reserved for future use   |

Typical patterns (optional):

- Some apps may mirror “just pressed”/“just released” states into 0x2621/0x2622, but this is not required by the spec.

## Endianness

- The VM is big‑endian for all 16‑bit values in memory, including IVT entries, control registers, and sprite X/Y.
- Registers/values are unsigned unless otherwise noted.

## Palette

| Index | Color Hex | Color Name          |
| ----- | --------- | ------------------- |
| 0     | #000000   | Black (Transparent) |
| 1     | #1D2B53   | Dark Blue           |
| 2     | #7E2553   | Dark Purple         |
| 3     | #008751   | Dark Green          |
| 4     | #AB5236   | Brown               |
| 5     | #5F574F   | Dark Gray           |
| 6     | #C2C3C7   | Light Gray          |
| 7     | #FFF1E8   | White               |
| 8     | #FF004D   | Red                 |
| 9     | #FFA300   | Orange              |
| 10    | #FFEC27   | Yellow              |
| 11    | #00E436   | Green               |
| 12    | #29ADFF   | Blue                |
| 13    | #83769C   | Indigo              |
| 14    | #FF77A8   | Pink                |
| 15    | #FFCCAA   | Peach               |

## Timing (TBD)

- Nominal frame rate: 60 Hz (recommended for apps).
- A VBlank flag or event can be added later if needed; for now apps can render every frame or on memory updates.

## Notes for Implementers

- The 512‑byte BG/FG maps are 32×16 indices; render a 30×14 window using pixel‑level scroll offsets with wraparound.
- Decode tiles once and cache them to avoid re‑parsing nibbles on every frame.
- Composition uses palette index 0 as transparent on all layers.
