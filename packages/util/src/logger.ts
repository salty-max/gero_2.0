export const ANSI_RED = '\x1b[31m'
export const ANSI_GREEN = '\x1b[32m'
export const ANSI_YELLOW = '\x1b[33m'
export const ANSI_BLUE = '\x1b[34m'
export const ANSI_MAGENTA = '\x1b[35m'
export const ANSI_CYAN = '\x1b[36m'
export const ANSI_GREY = '\x1b[90m'

export const ANSI_BOLD = '\x1b[1m'
export const ANSI_DIM = '\x1b[2m'
export const ANSI_UNDERLINE = '\x1b[4m'
export const ANSI_RESET = '\x1b[0m'

export const paint = (s: string, color: string, enabled = true) =>
  enabled && color ? `${color}${s}${ANSI_RESET}` : s

export function printf(msg: string, ...ansi: string[]) {
  console.log(`${ansi.join('')}${msg}${ANSI_RESET}`)
}

export function fmt16(v: number) {
  return `0x${(v & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`
}

export function fmt8(v: number) {
  return `0x${(v & 0x00ff).toString(16).toUpperCase().padStart(2, '0')}`
}
