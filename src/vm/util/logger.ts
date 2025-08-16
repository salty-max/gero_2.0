export const ANSI_RED = '\x1b[31m'
export const ANSI_GREEN = '\x1b[32m'
export const ANSI_BLUE = '\x1b[34m'
export const ANSI_GREY = '\x1b[90m'
export const ANSI_BOLD = '\x1b[1m'
export const ANSI_DIM = '\x1b[2m'
export const ANSI_RESET = '\x1b[0m'

export function printf(msg: string, ...ANSICodes: Array<string>) {
  for (const code in ANSICodes) {
    console.log(code)
  }
  console.log(msg)
  console.log(ANSI_RESET)
}

export function fmt16(v: number) {
  return `0x${(v & 0xffff).toString(16).padStart(4, '0')}`
}
