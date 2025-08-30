export const COLORS: number[][] = [
  [0x00, 0x00, 0x00, 0], // 0 black
  [0x1d, 0x2b, 0x53, 1], // 1 dark blue
  [0x7e, 0x25, 0x53, 1], // 2 dark purple
  [0x00, 0x87, 0x51, 1], // 3 dark green
  [0xab, 0x52, 0x36, 1], // 4 brown
  [0x5f, 0x57, 0x4f, 1], // 5 dark gray
  [0xc2, 0xc3, 0xc7, 1], // 6 light gray
  [0xff, 0xf1, 0xe8, 1], // 7 white
  [0xff, 0x00, 0x4d, 1], // 8 red
  [0xff, 0xa3, 0x00, 1], // 9 orange
  [0xff, 0xec, 0x27, 1], // 10 yellow
  [0x00, 0xe4, 0x36, 1], // 11 green
  [0x29, 0xad, 0xff, 1], // 12 blue
  [0x83, 0x76, 0x9c, 1], // 13 indigo
  [0xff, 0x77, 0xa8, 1], // 14 pink
  [0xff, 0xcc, 0xaa, 1], // 15 peach
]

export function toRgba([r, g, b, a]: number[]): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export function toRgbaIndex(index: number): string {
  if (COLORS[index] === undefined) {
    throw new Error(`Invalid color index: ${index}`)
  }
  const [r, g, b, a] = COLORS[index]
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
