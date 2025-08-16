import CPU from './vm/cpu'
import { createScreenDevice } from './vm/devices/screen-device'
import { OPCODES } from './vm/instructions'
import { createMemory } from './vm/memory'
import MemoryMapper from './vm/memory-mapper'
import { regIndex } from './vm/register'

const MM = new MemoryMapper()
const memory = createMemory(256 * 256)
MM.map(memory, 0, 0xffff)

// Screen device memory
MM.map(createScreenDevice(), 0x3000, 0x30ff, true)

const program = new Uint8Array(memory.buffer)
const cpu = new CPU(MM)

let i = 0

function writeCharToScreen(char: string, cmd: number, position: number) {
  program[i++] = OPCODES.MOV_LIT_REG
  program[i++] = cmd
  program[i++] = char.charCodeAt(0)
  program[i++] = regIndex('r1')

  program[i++] = OPCODES.MOV_REG_MEM
  program[i++] = regIndex('r1')
  program[i++] = 0x30
  program[i++] = position
}

writeCharToScreen(' ', 0xff, 0)

for (let i = 0; i <= 0xff; i++) {
  const cmd = i % 2 === 0 ? 0x03 : 0x04
  writeCharToScreen('*', cmd, i)
}

program[i++] = OPCODES.HLT

cpu.run()
