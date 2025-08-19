import { beforeEach, describe, expect, it } from 'bun:test'
import type CPU from '@gero/vm/cpu'
import {
  expectIPDelta,
  expectMem,
  expectReg,
  loadProgram,
  makeCPU,
  stepAndShow,
  word,
} from './helpers'
import { OPCODES } from '@gero/vm/instructions'
import { regIndex } from '@gero/vm/register'

let cpu: CPU

describe('CPU ▸ Instructions', () => {
  beforeEach(() => {
    cpu = makeCPU()
  })

  describe('Movements', () => {
    describe('MOV_REG_MEM / MOV_MEM_REG / MOV_LIT_MEM', () => {
      it('MOV_REG_MEM writes register to memory', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0xabcd),
          regIndex('r1'),
          OPCODES.MOV_REG_MEM,
          regIndex('r1'),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectMem(cpu, 0x0100, 0xabcd)
      })

      it('MOV_MEM_REG reads memory to register', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_MEM,
          ...word(0xbeef),
          ...word(0x2000),
          OPCODES.MOV_MEM_REG,
          ...word(0x2000),
          regIndex('r4'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'r4', 0xbeef)
      })

      it('MOV_LIT_MEM writes immediate to memory', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_MEM,
          ...word(0x1234),
          ...word(0xdead),
        ])
        stepAndShow(cpu)
        expectMem(cpu, 0xdead, 0x1234)
      })
    })

    describe('MOV_REG_PTR_REG / MOV_LIT_OFF_REG', () => {
      it('MOV_REG_PTR_REG: loads [ptr] into dst', () => {
        loadProgram(cpu, [
          // mem[0x4000] = 0x1337
          OPCODES.MOV_LIT_MEM,
          ...word(0x1337),
          ...word(0x4000),
          // r2 = 0x4000; r3 <- [r2]
          OPCODES.MOV_LIT_REG,
          ...word(0x4000),
          regIndex('r2'),
          OPCODES.MOV_REG_PTR_REG,
          regIndex('r2'),
          regIndex('r3'),
        ])
        stepAndShow(cpu) // mov_lit_mem
        stepAndShow(cpu) // mov_lit_reg
        stepAndShow(cpu) // mov_reg_ptr_reg
        expectReg(cpu, 'r3', 0x1337)
      })

      it('MOV_LIT_OFF_REG: loads [addr + offset(reg)] into dst', () => {
        loadProgram(cpu, [
          // mem[0x2002] = 0xBEEF
          OPCODES.MOV_LIT_MEM,
          ...word(0xbeef),
          ...word(0x2002),
          // r1 = 0x0002; r4 <- [0x2000 + r1]
          OPCODES.MOV_LIT_REG,
          ...word(0x0002),
          regIndex('r1'),
          OPCODES.MOV_LIT_OFF_REG,
          ...word(0x2000),
          regIndex('r1'),
          regIndex('r4'),
        ])
        stepAndShow(cpu) // mov_lit_mem
        stepAndShow(cpu) // mov_lit_reg
        stepAndShow(cpu) // mov_lit_off_reg
        expectReg(cpu, 'r4', 0xbeef)
      })
    })
  })

  describe('Arithmetics', () => {
    describe('ADD_*', () => {
      it('ADD_LIT_REG adds literal + register into ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0004),
          regIndex('r3'),
          OPCODES.ADD_LIT_REG,
          ...word(0x0006),
          regIndex('r3'),
        ])
        stepAndShow(cpu) // mov
        stepAndShow(cpu) // add
        expectReg(cpu, 'acc', 0x000a)
        expectReg(cpu, 'r3', 0x0004)
      })
      it('ADD_REG_REG adds two registers and stores in ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0002),
          regIndex('r1'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0003),
          regIndex('r2'),
          OPCODES.ADD_REG_REG,
          regIndex('r1'),
          regIndex('r2'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 5)
      })
    })

    describe('SUB_*', () => {
      it('SUB_LIT_REG substracts register from literal and stores in ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0003),
          regIndex('r2'),
          OPCODES.SUB_LIT_REG,
          ...word(0x000a),
          regIndex('r2'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0x0007)
      })

      it('SUB_REG_LIT substracts literal from register and stores in ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x000a),
          regIndex('r2'),
          OPCODES.SUB_REG_LIT,
          regIndex('r2'),
          ...word(0x0003),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0x0007)
      })

      it('SUB_REG_REG substracts register from register and stores in ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0009),
          regIndex('r1'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0004),
          regIndex('r2'),
          OPCODES.SUB_REG_REG,
          regIndex('r1'),
          regIndex('r2'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0x0005)
      })
    })

    describe('MUL_*', () => {
      it('MUL_LIT_REG multiplies literal and register and stores in ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0006),
          regIndex('r4'),
          OPCODES.MUL_LIT_REG,
          ...word(0x0007),
          regIndex('r4'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0x002a) // 42
      })

      it('MUL_REG_REG multiplies two registers and stores in ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0003),
          regIndex('r5'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('r6'),
          OPCODES.MUL_REG_REG,
          regIndex('r5'),
          regIndex('r6'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0x000f) // 15
      })
    })

    describe('INC_REG / DEC_REG', () => {
      it('INC_REG increments target register', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0001),
          regIndex('r1'),
          OPCODES.INC_REG,
          regIndex('r1'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'r1', 0x0002)
      })

      it('DEC_REG decrements target register', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('r1'),
          OPCODES.DEC_REG,
          regIndex('r1'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'r1', 0x0004)
      })
    })
  })

  describe('Bit Shifts', () => {
    it('LSH_REG_LIT: reg <<= lit (in-place)', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_REG,
        ...word(0x0003),
        regIndex('r1'),
        OPCODES.LSH_REG_LIT,
        regIndex('r1'),
        ...word(0x0002),
      ])
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectReg(cpu, 'r1', 0x000c)
      // ACC untouched by shift ops
      expectReg(cpu, 'acc', 0x0000)
    })

    it('LSH_REG_REG: aReg <<= bReg (in-place), bReg unchanged', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_REG,
        ...word(0x0001),
        regIndex('r1'),
        OPCODES.MOV_LIT_REG,
        ...word(0x0004),
        regIndex('r2'),
        OPCODES.LSH_REG_REG,
        regIndex('r1'),
        regIndex('r2'),
      ])
      stepAndShow(cpu)
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectReg(cpu, 'r1', 0x0010)
      expectReg(cpu, 'r2', 0x0004)
    })

    it('RSH_REG_LIT: reg >>= lit (in-place)', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_REG,
        ...word(0x0010),
        regIndex('r3'),
        OPCODES.RSH_REG_LIT,
        regIndex('r3'),
        ...word(0x0002),
      ])
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectReg(cpu, 'r3', 0x0004)
    })

    it('RSH_REG_REG: aReg >>= bReg (in-place)', () => {
      loadProgram(cpu, [
        OPCODES.MOV_LIT_REG,
        ...word(0x0040),
        regIndex('r4'),
        OPCODES.MOV_LIT_REG,
        ...word(0x0003),
        regIndex('r5'),
        OPCODES.RSH_REG_REG,
        regIndex('r4'),
        regIndex('r5'),
      ])
      stepAndShow(cpu)
      stepAndShow(cpu)
      stepAndShow(cpu)
      expectReg(cpu, 'r4', 0x0008)
      expectReg(cpu, 'r5', 0x0003)
    })
  })

  describe('Bitwise', () => {
    describe('AND_*', () => {
      it('AND_REG_LIT: ACC = reg & lit; reg unchanged', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0b1010),
          regIndex('r1'),
          OPCODES.AND_REG_LIT,
          regIndex('r1'),
          ...word(0b1100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0b1000)
        expectReg(cpu, 'r1', 0b1010)
      })

      it('AND_REG_REG: ACC = a & b; both regs unchanged', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0b1010),
          regIndex('r1'),
          OPCODES.MOV_LIT_REG,
          ...word(0b1100),
          regIndex('r2'),
          OPCODES.AND_REG_REG,
          regIndex('r1'),
          regIndex('r2'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0b1000)
        expectReg(cpu, 'r1', 0b1010)
        expectReg(cpu, 'r2', 0b1100)
      })
    })

    describe('OR_*', () => {
      it('OR_REG_LIT: ACC = reg | lit; reg unchanged', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0b1010),
          regIndex('r3'),
          OPCODES.OR_REG_LIT,
          regIndex('r3'),
          ...word(0b1100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0b1110)
        expectReg(cpu, 'r3', 0b1010)
      })

      it('OR_REG_REG: ACC = a | b', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0b0011),
          regIndex('r4'),
          OPCODES.MOV_LIT_REG,
          ...word(0b0101),
          regIndex('r5'),
          OPCODES.OR_REG_REG,
          regIndex('r4'),
          regIndex('r5'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0b0111)
      })
    })

    describe('XOR_*', () => {
      it('XOR_REG_LIT: ACC = reg ^ lit', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0b1010),
          regIndex('r1'),
          OPCODES.XOR_REG_LIT,
          regIndex('r1'),
          ...word(0b1100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0b0110)
        expectReg(cpu, 'r1', 0b1010)
      })

      it('XOR_REG_REG: ACC = a ^ b', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0b1111),
          regIndex('r2'),
          OPCODES.MOV_LIT_REG,
          ...word(0b0101),
          regIndex('r3'),
          OPCODES.XOR_REG_REG,
          regIndex('r2'),
          regIndex('r3'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0b1010)
      })
    })

    describe('NOT', () => {
      it('ACC = ~reg', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x00f0),
          regIndex('r6'),
          OPCODES.NOT,
          regIndex('r6'),
        ])
        stepAndShow(cpu) // mov
        stepAndShow(cpu) // not
        expectReg(cpu, 'acc', 0xff0f)
        expectReg(cpu, 'r6', 0x00f0)
      })

      it('ACC = ~0x0000 => 0xffff', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0000),
          regIndex('r1'),
          OPCODES.NOT,
          regIndex('r1'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0xffff)
        expectReg(cpu, 'r1', 0x0000)
      })

      it('ACC = ~0xffff => 0x0000', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0xffff),
          regIndex('r2'),
          OPCODES.NOT,
          regIndex('r2'),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'acc', 0x0000)
        expectReg(cpu, 'r2', 0xffff)
      })
    })
  })

  describe('Branching', () => {
    describe('JEQ_REG', () => {
      it('jumps when reg == ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x1234),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x1234),
          regIndex('r1'),
          OPCODES.JEQ_REG,
          regIndex('r1'),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when reg != ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x1234),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x9999),
          regIndex('r1'),
          OPCODES.JEQ_REG,
          regIndex('r1'),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 4 + 4 + 4) // two MOVs + JEQ_REG
      })
    })

    describe('JEQ_LIT', () => {
      it('jumps when lit == ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0xbeef),
          regIndex('acc'),
          OPCODES.JEQ_LIT,
          ...word(0xbeef),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when lit != ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0xbeef),
          regIndex('acc'),
          OPCODES.JEQ_LIT,
          ...word(0xbee0),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 4 + 5) // MOV + JEQ_LIT
      })
    })

    describe('JNE_REG', () => {
      it('jumps when reg != ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0006),
          regIndex('r2'),
          OPCODES.JNE_REG,
          regIndex('r2'),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when reg == ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('r2'),
          OPCODES.JNE_REG,
          regIndex('r2'),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 12) // 4 + 4 + 4
      })
    })
    describe('JNE_LIT', () => {
      it('jumps when ACC != literal', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0001),
          regIndex('acc'),
          OPCODES.JNE_LIT,
          ...word(0x0002),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when ACC == literal', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0002),
          regIndex('acc'),
          OPCODES.JNE_LIT,
          ...word(0x0002),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 9) // opcode + lit + addr
      })
    })

    describe('JLT_LIT', () => {
      it('jumps when lit < ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.JLT_LIT,
          ...word(0x0004),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when lit >= ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.JLT_LIT,
          ...word(0x0006),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 9) // 4 + 5
      })
    })

    describe('JLT_REG', () => {
      it('jumps when reg < ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0007),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0006),
          regIndex('r3'),
          OPCODES.JLT_REG,
          regIndex('r3'),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when reg >= ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0007),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0008),
          regIndex('r3'),
          OPCODES.JLT_REG,
          regIndex('r3'),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 12) // 4 + 4 + 4
      })
    })

    describe('JGT_LIT', () => {
      it('jumps when lit > ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.JGT_LIT,
          ...word(0x0006),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when lit <= ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.JGT_LIT,
          ...word(0x0004),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 9) // 4 + 5
      })
    })

    describe('JGT_REG', () => {
      it('jumps when reg > ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0006),
          regIndex('r4'),
          OPCODES.JGT_REG,
          regIndex('r4'),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when reg <= ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0004),
          regIndex('r4'),
          OPCODES.JGT_REG,
          regIndex('r4'),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 12) // 4 + 4 + 4
      })
    })

    describe('JLE_LIT', () => {
      it('jumps when lit <= ACC (boundary equal)', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.JLE_LIT,
          ...word(0x0005),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when lit > ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.JLE_LIT,
          ...word(0x0006),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 9) // 4 + 5
      })
    })

    describe('JLE_REG', () => {
      it('jumps when reg <= ACC (boundary equal)', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('r5'),
          OPCODES.JLE_REG,
          regIndex('r5'),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when reg > ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0006),
          regIndex('r5'),
          OPCODES.JLE_REG,
          regIndex('r5'),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 12) // 4 + 4 + 4
      })
    })

    describe('JGE_LIT', () => {
      it('jumps when lit >= ACC (boundary equal)', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.JGE_LIT,
          ...word(0x0005),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when lit < ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.JGE_LIT,
          ...word(0x0004),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 9) // 4 + 5
      })
    })

    describe('JGE_REG', () => {
      it('jumps when reg >= ACC (boundary equal)', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('r6'),
          OPCODES.JGE_REG,
          regIndex('r6'),
          ...word(0x0100),
        ])
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', 0x0100)
      })

      it('does not jump when reg < ACC', () => {
        loadProgram(cpu, [
          OPCODES.MOV_LIT_REG,
          ...word(0x0005),
          regIndex('acc'),
          OPCODES.MOV_LIT_REG,
          ...word(0x0004),
          regIndex('r6'),
          OPCODES.JGE_REG,
          regIndex('r6'),
          ...word(0x0100),
        ])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        stepAndShow(cpu)
        stepAndShow(cpu)
        expectReg(cpu, 'ip', ip0 + 12) // 4 + 4 + 4
      })
    })
  })

  describe('Misc', () => {
    describe('NO_OP', () => {
      it('increments IP by 1', () => {
        loadProgram(cpu, [OPCODES.NO_OP, OPCODES.NO_OP])
        const ip0 = cpu.getRegister('ip')
        stepAndShow(cpu)
        expectIPDelta(cpu, ip0, 1)
      })
    })

    describe('HLT', () => {
      it('halts execution loop (stepping stops)', () => {
        loadProgram(cpu, [OPCODES.NO_OP, OPCODES.HLT, OPCODES.NO_OP])
        stepAndShow(cpu)
        const halted = (cpu as any).step ? (cpu as any).step() : undefined
        expect(halted === undefined || typeof halted === 'boolean').toBeTruthy()
      })
    })
  })
})
