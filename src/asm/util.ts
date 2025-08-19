import {
  ANSI_GREY,
  ANSI_CYAN,
  ANSI_MAGENTA,
  ANSI_RESET,
  paint,
} from '../vm/util/logger'

export type HexTableOptions = {
  startAddress?: number
  bytesPerRow?: number
  groupEvery?: number
  showAscii?: boolean
  addressWidth?: number
  useColor?: boolean
  fillEmpty?: boolean
  hexPad?: string
  asciiPadChar?: string
  theme?: Partial<HexTheme>
}

export type HexTheme = {
  addr: string
  sep: string
  hex: string
  zero: string
  ff: string
  gap: string
  pad: string
  asciiBar: string
  asciiText: string
  asciiDot: string
  asciiPad: string
  reset: string
}

const DEFAULT_THEME: HexTheme = {
  addr: ANSI_CYAN,
  sep: ANSI_GREY,
  hex: '',
  zero: '',
  ff: ANSI_MAGENTA,
  gap: ANSI_GREY,
  pad: ANSI_GREY,
  asciiBar: ANSI_GREY,
  asciiText: ANSI_CYAN,
  asciiDot: ANSI_GREY,
  asciiPad: '',
  reset: ANSI_RESET,
}

const hex2 = (n: number) =>
  (n & 0xff).toString(16).toUpperCase().padStart(2, '0')

const hexN = (n: number, w: number) =>
  (n >>> 0).toString(16).toUpperCase().padStart(w, '0')

const isPrintable = (b: number) => b >= 0x20 && b <= 0x7e

export function toHexTable(
  bytes: readonly number[],
  opts: HexTableOptions = {}
): string {
  const {
    startAddress = 0,
    bytesPerRow = 16,
    groupEvery = 2,
    showAscii = true,
    addressWidth,
    useColor = typeof process !== 'undefined' &&
      !!(process.stdout as any)?.isTTY,
    fillEmpty = true,
    hexPad = '..',
    asciiPadChar: asciiPadCharOpt,
    theme: userTheme = {},
  } = opts

  const asciiPadChar = asciiPadCharOpt ?? (hexPad === '..' ? '.' : ' ')
  const theme = { ...DEFAULT_THEME, ...userTheme }

  // compute address column width
  const maxAddr = startAddress + Math.max(bytes.length - 1, 0)
  const addrW = addressWidth ?? Math.max(4, hexN(maxAddr, 0).length)

  // how wide is the hex field when a row is full?
  const gapsPerRow =
    groupEvery > 0 ? Math.floor((bytesPerRow - 1) / groupEvery) : 0
  const fullRowHexWidth = bytesPerRow * 2 + (bytesPerRow - 1) + gapsPerRow

  const lines: string[] = []

  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    const row = bytes.slice(i, i + bytesPerRow).map((b) => b & 0xff)
    const rowLen = row.length

    // address
    const addrRaw = hexN(startAddress + i, addrW)
    const addrCol =
      paint(addrRaw, theme.addr, useColor) + paint(':', theme.sep, useColor)

    // hex column (raw lengths are used to compute padding spaces)
    const hexRawParts: string[] = []
    const hexColParts: string[] = []

    const renderCells = fillEmpty ? bytesPerRow : rowLen

    for (let j = 0; j < renderCells; j++) {
      const isReal = j < rowLen

      if (isReal) {
        const b = row[j]!
        const h = hex2(b)
        const color =
          b === 0x00 ? theme.zero : b === 0xff ? theme.ff : theme.hex
        hexRawParts.push(h)
        hexColParts.push(paint(h, color, useColor))
      } else {
        // padded byte cell → use hexPad token (e.g., '..')
        hexRawParts.push(hexPad)
        hexColParts.push(paint(hexPad, theme.pad, useColor))
      }

      const isLast = j === renderCells - 1
      if (!isLast) {
        // inter-byte single space
        hexRawParts.push(' ')
        hexColParts.push(' ')
        // group gap (adds an extra space)
        if (groupEvery > 0 && (j + 1) % groupEvery === 0) {
          hexRawParts.push(' ')
          hexColParts.push(paint(' ', theme.gap, useColor))
        }
      }
    }

    let hexField = hexColParts.join('')

    // ensure fixed width of the hex field when filling
    if (fillEmpty) {
      const rawLen = hexRawParts.join('').length
      if (rawLen < fullRowHexWidth) {
        hexField += ' '.repeat(fullRowHexWidth - rawLen)
      }
    }

    // ASCII gutter
    let ascii = ''
    if (showAscii) {
      const asciiCells = fillEmpty ? bytesPerRow : rowLen
      const asciiChars: string[] = []

      for (let j = 0; j < asciiCells; j++) {
        if (j < rowLen) {
          const b = row[j]!
          const ch = isPrintable(b) ? String.fromCharCode(b) : '.'
          const col = isPrintable(b) ? theme.asciiText : theme.asciiDot
          asciiChars.push(paint(ch, col, useColor))
        } else {
          // pad to full width with asciiPadChar
          asciiChars.push(paint(asciiPadChar, theme.asciiDot, useColor))
        }
      }

      ascii =
        ' ' +
        paint('|', theme.asciiBar, useColor) +
        asciiChars.join('') +
        paint('|', theme.asciiBar, useColor)
    }
    lines.push(`${addrCol} ${hexField}${ascii}`)
  }

  // special case: empty input → still print the address header
  if (bytes.length === 0) {
    const addrRaw = hexN(startAddress, addrW)
    lines.push(
      paint(addrRaw, theme.addr, useColor) + paint(':', theme.sep, useColor)
    )
  }

  return lines.join('\n')
}

export const printHexTable = (
  bytes: readonly number[],
  opts?: HexTableOptions
) => {
  console.log(toHexTable(bytes, opts))
}
