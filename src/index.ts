import CPU from './vm/cpu'
import {
  BANK_COUNT,
  BANK_SIZE,
  createBankedMemory,
} from './vm/devices/memory-bank'
import { createMemory } from './vm/memory'
import MemoryMapper from './vm/memory-mapper'
import { fmt16 } from './vm/util'

const MM = new MemoryMapper()
const cpu = new CPU(MM)

const memoryBankDevice = createBankedMemory(BANK_COUNT, BANK_SIZE, () =>
  cpu.getRegister('mb')
)
MM.map(memoryBankDevice, 0, BANK_SIZE)

const regularMemory = createMemory(0xff00)
MM.map(regularMemory, BANK_SIZE, 0xffff, true)

console.log('Writing value 0x0001 at address 0x0000')
MM.setUint16(0x0000, 0x01)
console.log('Reading value at address 0x0000: ', fmt16(MM.getUint16(0)))
console.log('\n::: switching memory bank (0 -> 1)')
cpu.setRegister('mb', 1)
console.log('Reading value at address 0x0000: ', fmt16(MM.getUint16(0)))
console.log('Writing value 0xCAFE at address 0x0000')
MM.setUint16(0, 0xcafe)
console.log('\n::: switching memory bank (1 -> 2)')
cpu.setRegister('mb', 2)
console.log('Reading value at address 0x0000: ', fmt16(MM.getUint16(0)))
console.log('\n::: switching memory bank (2 -> 1)')
cpu.setRegister('mb', 1)
console.log('Reading value at address 0x0000: ', fmt16(MM.getUint16(0)))
console.log('\n::: switching memory bank (1 -> 0)')
cpu.setRegister('mb', 0)
console.log('Reading value at address 0x0000: ', fmt16(MM.getUint16(0)))
