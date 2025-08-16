import type { Device } from '../memory-mapper'
import { ANSI_BLUE, ANSI_BOLD, ANSI_RED, ANSI_RESET } from '../util'

function moveTo(x: number, y: number) {
  process.stdout.write(`\x1b[${y};${x}H`)
}

function eraseScreen() {
  process.stdout.write('\x1b[2J')
}

function setBold() {
  process.stdout.write(ANSI_BOLD)
}

function setBlue() {
  process.stdout.write(ANSI_BLUE)
}

function setRed() {
  process.stdout.write(ANSI_RED)
}

function reset() {
  process.stdout.write(ANSI_RESET)
}

export function createScreenDevice(): Device {
  return {
    getUint8: () => 0,
    getUint16: () => 0,
    setUint8: () => {},
    setUint16: (addr: number, data: number) => {
      const cmd = (data & 0xff00) >> 8
      const charValue = data & 0x00ff

      if (cmd === 0xff) {
        eraseScreen()
      } else if (cmd === 0x01) {
        setBold()
      } else if (cmd === 0x02) {
        reset()
      } else if (cmd === 0x03) {
        setBlue()
      } else if (cmd === 0x04) {
        setRed()
      }

      const x = (addr % 16) + 1
      const y = Math.floor(addr / 16) + 1

      moveTo(x * 2, y)

      const char = String.fromCharCode(charValue)
      process.stdout.write(char)
    },
  }
}
