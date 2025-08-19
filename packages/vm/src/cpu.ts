import { createMemory, type Memory } from './memory'
import {
  OPCODE_METAS,
  OPCODES,
  OpType,
  type Opcode,
  type OperandTuple,
} from './instructions'
import { regIndex, REGISTER_NAMES, type RegName } from './register'
import {
  ANSI_GREY,
  ANSI_BOLD,
  ANSI_DIM,
  ANSI_GREEN,
  ANSI_RED,
  ANSI_RESET,
  fmt16,
  ANSI_BLUE,
} from '@gero/util/logger'
import { u16 } from './util'
import type MemoryMapper from './memory-mapper'

class CPU {
  private memory: MemoryMapper
  private lastRegs: Record<RegName, number>
  private registers: Memory
  private stackFrameSize: number
  private vectorTableBase: number
  private isIrqActive: boolean

  constructor(memory: MemoryMapper, ivAddr = 0x1000) {
    this.memory = memory
    this.registers = createMemory(REGISTER_NAMES.length * 2)
    this.stackFrameSize = 0
    this.vectorTableBase = ivAddr
    this.isIrqActive = false
    this.writeReg(regIndex('sp'), memory.byteLength - 2)
    this.writeReg(regIndex('fp'), memory.byteLength - 2)
    this.writeReg(regIndex('im'), 0xffff)

    // Snapshot the initial registers values
    this.lastRegs = Object.fromEntries(
      REGISTER_NAMES.map((n) => [n, this.readReg(regIndex(n))])
    ) as Record<RegName, number>
  }

  get inISR(): boolean {
    return this.isIrqActive
  }

  set inISR(value: boolean) {
    this.isIrqActive = value
  }

  getMemory(): MemoryMapper {
    return this.memory
  }

  getRegister(name: RegName): number {
    return this.readReg(regIndex(name))
  }

  setRegister(name: RegName, value: number) {
    this.writeReg(regIndex(name), value)
  }

  readByte(addr: number): number {
    this.assertAddr(addr, 1)
    return this.memory.getUint8(addr)
  }

  writeByte(addr: number, value: number) {
    this.assertAddr(addr, 1)
    this.memory.setUint8(addr, value & 0xff)
  }

  readWord(addr: number): number {
    this.assertAddr(addr, 2)
    return this.memory.getUint16(addr)
  }

  writeWord(addr: number, value: number) {
    this.assertAddr(addr, 2)
    this.memory.setUint16(addr, u16(value))
  }

  execute(opcode: Opcode): boolean | void {
    const meta = OPCODE_METAS[opcode]
    const handler = HANDLERS[opcode]
    if (!handler)
      throw new Error(
        `Unimplemented opcode: ${fmt16(opcode)} (${meta?.name ?? '?'})`
      )
    return handler(this)
  }

  step(): boolean {
    const opcode = this.fetchByte() as Opcode
    return Boolean(this.execute(opcode))
  }

  run() {
    const halt = this.step()
    if (!halt) {
      setImmediate(() => this.run())
    }
  }

  debug(opts: { diffOnly?: boolean; arrows?: boolean } = {}) {
    let out = ''
    REGISTER_NAMES.forEach((name, i) => {
      const cur = this.readReg(regIndex(name))
      const prev = this.lastRegs[name]
      const changed = prev !== undefined && prev !== cur

      if (opts.diffOnly && !changed) return

      const color = changed ? ANSI_GREEN : ANSI_GREY
      const body =
        changed && opts.arrows && prev !== undefined
          ? `${fmt16(prev)}${ANSI_DIM} → ${ANSI_RESET}${color}${fmt16(cur)}`
          : fmt16(cur)

      out += `${name}:\t${color}${body}${ANSI_RESET}\t`

      if (!opts.diffOnly && (i + 1) % 4 === 0) out += '\n'
      this.lastRegs[name] = cur
    })
    console.log(out + '\n')
  }

  debugDiff(
    opts: { unchanged?: 'hide' | 'dim' | 'show'; label?: string } = {}
  ) {
    const { unchanged = 'hide', label } = opts
    const curr = Object.fromEntries(
      REGISTER_NAMES.map((n) => [n, this.readReg(regIndex(n))])
    ) as Record<RegName, number>

    const firstRun = !this.lastRegs || Object.keys(this.lastRegs).length === 0
    if (firstRun) {
      this.lastRegs = { ...curr }
    }

    const nameWidth = Math.max(...REGISTER_NAMES.map((n) => n.length))
    let out = ''
    const headerLeft = label ? `prev (${label}-1)` : 'prev'
    const headerRight = label ? `curr (${label})` : 'curr'
    out += `${ANSI_BOLD}${ANSI_GREY}--- ${headerLeft}${ANSI_RESET}\n`
    out += `${ANSI_BOLD}${ANSI_GREY}+++ ${headerRight}${ANSI_RESET}\n`

    for (const name of REGISTER_NAMES) {
      const prev = this.lastRegs[name]
      const cur = curr[name]
      const changed = prev !== cur

      if (!changed) {
        if (unchanged === 'hide') continue
        const line = ` ${name.padEnd(nameWidth)}: ${fmt16(cur)}`
        out +=
          (unchanged === 'dim'
            ? `${ANSI_DIM}${ANSI_GREY}${line}${ANSI_RESET}`
            : line) + '\n'
        continue
      }

      out += `${ANSI_RED}-${name.padEnd(nameWidth)}: ${fmt16(prev)}${ANSI_RESET}\n`
      out += `${ANSI_GREEN}+${name.padEnd(nameWidth)}: ${fmt16(cur)}${ANSI_RESET}\n`
    }
    console.log(out.trimEnd() + '\n')
    this.lastRegs = curr
  }

  viewMemoryAt(addr: number, length = 8) {
    // clamp start
    if (addr < 0) addr = 0
    if (addr >= this.memory.byteLength) {
      console.log(`${ANSI_BLUE}${fmt16(addr)}${ANSI_RESET}: <out of range>`)
      return
    }

    // clamp length so we don’t overrun RAM
    const maxLen = Math.min(length, this.memory.byteLength - addr)
    const bytes = Array.from({ length: maxLen }, (_, i) =>
      this.readByte(addr + i)
    )

    const hexCol = bytes
      .map((v) =>
        v === 0
          ? `${ANSI_DIM}00${ANSI_RESET}`
          : `${ANSI_GREEN}${v.toString(16).padStart(2, '0')}${ANSI_RESET}`
      )
      .join(' ')

    const asciiCol = bytes
      .map((v) => (v >= 0x20 && v <= 0x7e ? String.fromCharCode(v) : '.'))
      .join('')

    console.log(
      `${ANSI_BLUE}${fmt16(addr)}${ANSI_RESET}: ${hexCol}  ${ANSI_DIM}|${asciiCol}|${ANSI_RESET}`
    )
  }
  private assertReg(idx: number) {
    if (idx < 0 || idx >= REGISTER_NAMES.length) {
      throw new Error(`Invalid register index ${idx}`)
    }
  }

  private assertAddr(addr: number, width: number) {
    if (addr < 0 || addr + width > this.memory.byteLength) {
      throw new RangeError(
        `Memory access out of range: addr=${fmt16(addr)} width=${width} (size=${this.memory.byteLength})`
      )
    }
  }

  readReg(idx: number): number {
    this.assertReg(idx)
    return this.registers.getUint16(idx * 2)
  }

  writeReg(idx: number, value: number) {
    this.assertReg(idx)
    this.registers.setUint16(idx * 2, u16(value))
  }

  push(value: number) {
    const spAddr = this.readReg(regIndex('sp'))
    this.writeWord(spAddr, value)
    this.writeReg(regIndex('sp'), spAddr - 2)
    this.stackFrameSize += 2
  }

  pop(): number {
    const nextSpAddr = this.readReg(regIndex('sp')) + 2
    this.writeReg(regIndex('sp'), nextSpAddr)
    this.stackFrameSize -= 2
    return this.readWord(nextSpAddr)
  }

  pushState() {
    // Save registers
    for (let i = 0; i < 8; i++) {
      this.push(this.readReg(regIndex(`r${i + 1}` as RegName)))
    }

    // Save return address
    this.push(this.readReg(regIndex('ip')))

    // Push stack frame size
    this.push(this.stackFrameSize + 2)

    // Update frame pointer and reset local pointer
    this.writeReg(regIndex('fp'), this.readReg(regIndex('sp')))
    this.stackFrameSize = 0
  }

  popState() {
    // Restore stack pointer to frame base
    const fpAddr = this.readReg(regIndex('fp'))
    this.writeReg(regIndex('sp'), fpAddr)

    // Pop saved frame size
    this.stackFrameSize = this.pop()
    const frameSize = this.stackFrameSize

    // Pop return address and jump back
    this.writeReg(regIndex('ip'), this.pop())

    // Restore registers
    for (let i = 8; i > 0; i--) {
      this.writeReg(regIndex(`r${i}` as RegName), this.pop())
    }

    const nArgs = this.pop()
    for (let i = 0; i < nArgs; i++) {
      this.pop()
    }

    this.writeReg(regIndex('fp'), fpAddr + frameSize)
  }

  handleInterrupt(vectorReq: number) {
    const vector = vectorReq % 0x10
    const mask = this.readReg(regIndex('im'))
    const enabled = Boolean((1 << vector) & mask)
    if (!enabled) return

    const vectorEntryAddr = this.vectorTableBase + vector * 2
    const handlerAddr = this.readWord(vectorEntryAddr)

    if (!this.inISR) {
      this.push(0)
      this.pushState()
    }

    this.inISR = true
    this.writeReg(regIndex('ip'), handlerAddr)
  }

  fetchOperands<O extends Opcode>(opcode: O): OperandTuple[O] {
    const schema = OPCODE_METAS[opcode].schema

    // Mutable tuple during construction
    const out = [] as unknown as {
      -readonly [K in keyof OperandTuple[O]]: OperandTuple[O][K]
    }

    schema.forEach((kind, i) => {
      let val: number
      switch (kind) {
        case OpType.Reg: {
          val = this.fetchByte() % REGISTER_NAMES.length
          out[i] = val as OperandTuple[O][typeof i]
          break
        }
        case OpType.Imm16:
        case OpType.Addr: {
          val = this.fetchWord()
          out[i] = val as OperandTuple[O][typeof i]
          break
        }
        case OpType.Imm8: {
          val = this.fetchByte()
          out[i] = val as OperandTuple[O][typeof i]
          break
        }
      }
    })

    return out as OperandTuple[O]
  }

  private fetchByte(): number {
    const ipIdx = regIndex('ip')
    const nextInstrAddr = this.readReg(ipIdx)
    const instr = this.readByte(nextInstrAddr)
    this.writeReg(ipIdx, nextInstrAddr + 1)
    return instr
  }

  private fetchWord(): number {
    const ipIdx = regIndex('ip')
    const nextInstrAddr = this.readReg(ipIdx)
    const instr = this.readWord(nextInstrAddr)
    this.writeReg(ipIdx, nextInstrAddr + 2)
    return instr
  }
}

type OpcodeHandler = (cpu: CPU) => boolean | void

export const HANDLERS: {
  [C in Opcode]: OpcodeHandler
} = {
  // move operations
  [OPCODES.MOV_LIT_REG]: (cpu) => {
    const [lit, dst] = cpu.fetchOperands(OPCODES.MOV_LIT_REG)
    cpu.writeReg(dst, lit)
  },
  [OPCODES.MOV_REG_REG]: (cpu) => {
    const [src, dst] = cpu.fetchOperands(OPCODES.MOV_REG_REG)
    cpu.writeReg(dst, cpu.readReg(src))
  },
  [OPCODES.MOV_REG_MEM]: (cpu) => {
    const [src, addr] = cpu.fetchOperands(OPCODES.MOV_REG_MEM)
    cpu.writeWord(addr, cpu.readReg(src))
  },
  [OPCODES.MOV_MEM_REG]: (cpu) => {
    const [addr, dst] = cpu.fetchOperands(OPCODES.MOV_MEM_REG)
    cpu.writeReg(dst, cpu.readWord(addr))
  },
  [OPCODES.MOV8_MEM_REG]: (cpu) => {
    const [addr, reg] = cpu.fetchOperands(OPCODES.MOV8_MEM_REG)
    cpu.writeReg(reg, cpu.readByte(addr))
  },
  [OPCODES.MOV_LIT_MEM]: (cpu) => {
    const [lit, addr] = cpu.fetchOperands(OPCODES.MOV_LIT_MEM)
    cpu.writeWord(addr, lit)
  },
  [OPCODES.MOV8_LIT_MEM]: (cpu) => {
    const [lit, addr] = cpu.fetchOperands(OPCODES.MOV8_LIT_MEM)
    cpu.writeByte(addr, lit)
  },
  [OPCODES.MOV_REG_PTR_REG]: (cpu) => {
    const [src, dst] = cpu.fetchOperands(OPCODES.MOV_REG_PTR_REG)
    const ptr = cpu.readReg(src)
    cpu.writeReg(dst, cpu.readWord(ptr))
  },
  [OPCODES.MOV_LIT_OFF_REG]: (cpu) => {
    const [addr, src, dst] = cpu.fetchOperands(OPCODES.MOV_LIT_OFF_REG)
    const offset = cpu.readReg(src)
    cpu.writeReg(dst, cpu.readWord(addr + offset))
  },

  // stack operations
  [OPCODES.PSH_LIT]: (cpu) => {
    const [lit] = cpu.fetchOperands(OPCODES.PSH_LIT)
    cpu.push(lit)
  },
  [OPCODES.PSH_REG]: (cpu) => {
    const [src] = cpu.fetchOperands(OPCODES.PSH_REG)
    cpu.push(cpu.readReg(src))
  },
  [OPCODES.POP]: (cpu) => {
    const [dst] = cpu.fetchOperands(OPCODES.POP)
    cpu.writeReg(dst, cpu.pop())
  },

  // arithmetics
  [OPCODES.ADD_LIT_REG]: (cpu) => {
    const [lit, reg] = cpu.fetchOperands(OPCODES.ADD_LIT_REG)
    cpu.writeReg(regIndex('acc'), lit + cpu.readReg(reg))
  },
  [OPCODES.ADD_REG_REG]: (cpu) => {
    const [aReg, bReg] = cpu.fetchOperands(OPCODES.ADD_REG_REG)
    cpu.writeReg(regIndex('acc'), cpu.readReg(aReg) + cpu.readReg(bReg))
  },
  [OPCODES.SUB_LIT_REG]: (cpu) => {
    const [lit, reg] = cpu.fetchOperands(OPCODES.SUB_LIT_REG)
    cpu.writeReg(regIndex('acc'), lit - cpu.readReg(reg))
  },
  [OPCODES.SUB_REG_LIT]: (cpu) => {
    const [reg, lit] = cpu.fetchOperands(OPCODES.SUB_REG_LIT)
    cpu.writeReg(regIndex('acc'), cpu.readReg(reg) - lit)
  },
  [OPCODES.SUB_REG_REG]: (cpu) => {
    const [aReg, bReg] = cpu.fetchOperands(OPCODES.SUB_REG_REG)
    cpu.writeReg(regIndex('acc'), cpu.readReg(aReg) - cpu.readReg(bReg))
  },
  [OPCODES.MUL_LIT_REG]: (cpu) => {
    const [lit, reg] = cpu.fetchOperands(OPCODES.MUL_LIT_REG)
    cpu.writeReg(regIndex('acc'), lit * cpu.readReg(reg))
  },
  [OPCODES.MUL_REG_REG]: (cpu) => {
    const [aReg, bReg] = cpu.fetchOperands(OPCODES.MUL_REG_REG)
    cpu.writeReg(regIndex('acc'), cpu.readReg(aReg) * cpu.readReg(bReg))
  },

  // bit shifts
  [OPCODES.LSH_REG_LIT]: (cpu) => {
    const [reg, shift] = cpu.fetchOperands(OPCODES.LSH_REG_LIT)
    const res = cpu.readReg(reg) << shift
    cpu.writeReg(reg, res)
  },
  [OPCODES.LSH_REG_REG]: (cpu) => {
    const [aReg, bReg] = cpu.fetchOperands(OPCODES.LSH_REG_REG)
    const res = cpu.readReg(aReg) << cpu.readReg(bReg)
    cpu.writeReg(aReg, res)
  },
  [OPCODES.RSH_REG_LIT]: (cpu) => {
    const [reg, shift] = cpu.fetchOperands(OPCODES.RSH_REG_LIT)
    const res = cpu.readReg(reg) >> shift
    cpu.writeReg(reg, res)
  },
  [OPCODES.RSH_REG_REG]: (cpu) => {
    const [aReg, bReg] = cpu.fetchOperands(OPCODES.RSH_REG_REG)
    const res = cpu.readReg(aReg) >> cpu.readReg(bReg)
    cpu.writeReg(aReg, res)
  },
  [OPCODES.AND_REG_LIT]: (cpu) => {
    const [reg, lit] = cpu.fetchOperands(OPCODES.AND_REG_LIT)
    cpu.writeReg(regIndex('acc'), cpu.readReg(reg) & lit)
  },
  [OPCODES.AND_REG_REG]: (cpu) => {
    const [aReg, bReg] = cpu.fetchOperands(OPCODES.AND_REG_REG)
    cpu.writeReg(regIndex('acc'), cpu.readReg(aReg) & cpu.readReg(bReg))
  },
  [OPCODES.OR_REG_LIT]: (cpu) => {
    const [reg, lit] = cpu.fetchOperands(OPCODES.OR_REG_LIT)
    cpu.writeReg(regIndex('acc'), cpu.readReg(reg) | lit)
  },
  [OPCODES.OR_REG_REG]: (cpu) => {
    const [aReg, bReg] = cpu.fetchOperands(OPCODES.OR_REG_REG)
    cpu.writeReg(regIndex('acc'), cpu.readReg(aReg) | cpu.readReg(bReg))
  },
  [OPCODES.XOR_REG_LIT]: (cpu) => {
    const [reg, lit] = cpu.fetchOperands(OPCODES.XOR_REG_LIT)
    cpu.writeReg(regIndex('acc'), cpu.readReg(reg) ^ lit)
  },
  [OPCODES.XOR_REG_REG]: (cpu) => {
    const [aReg, bReg] = cpu.fetchOperands(OPCODES.XOR_REG_REG)
    cpu.writeReg(regIndex('acc'), cpu.readReg(aReg) ^ cpu.readReg(bReg))
  },
  [OPCODES.NOT]: (cpu) => {
    const [reg] = cpu.fetchOperands(OPCODES.NOT)
    cpu.writeReg(regIndex('acc'), ~cpu.readReg(reg) & 0xffff)
  },
  [OPCODES.INC_REG]: (cpu) => {
    const [reg] = cpu.fetchOperands(OPCODES.INC_REG)
    cpu.writeReg(reg, cpu.readReg(reg) + 1)
  },
  [OPCODES.DEC_REG]: (cpu) => {
    const [reg] = cpu.fetchOperands(OPCODES.DEC_REG)
    cpu.writeReg(reg, cpu.readReg(reg) - 1)
  },

  // control flow / calls
  [OPCODES.JEQ_REG]: (cpu) => {
    const [reg, addr] = cpu.fetchOperands(OPCODES.JEQ_REG)
    if (cpu.readReg(reg) === cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JEQ_LIT]: (cpu) => {
    const [lit, addr] = cpu.fetchOperands(OPCODES.JEQ_LIT)
    if (lit === cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JNE_REG]: (cpu) => {
    const [reg, addr] = cpu.fetchOperands(OPCODES.JNE_REG)
    if (cpu.readReg(reg) !== cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JNE_LIT]: (cpu) => {
    const [lit, addr] = cpu.fetchOperands(OPCODES.JNE_LIT)
    if (lit !== cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JLT_REG]: (cpu) => {
    const [reg, addr] = cpu.fetchOperands(OPCODES.JLT_REG)
    if (cpu.readReg(reg) < cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JLT_LIT]: (cpu) => {
    const [lit, addr] = cpu.fetchOperands(OPCODES.JLT_LIT)
    if (lit < cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JGT_REG]: (cpu) => {
    const [reg, addr] = cpu.fetchOperands(OPCODES.JGT_REG)
    if (cpu.readReg(reg) > cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JGT_LIT]: (cpu) => {
    const [lit, addr] = cpu.fetchOperands(OPCODES.JGT_LIT)
    if (lit > cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JLE_REG]: (cpu) => {
    const [reg, addr] = cpu.fetchOperands(OPCODES.JLE_REG)
    if (cpu.readReg(reg) <= cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JLE_LIT]: (cpu) => {
    const [lit, addr] = cpu.fetchOperands(OPCODES.JLE_LIT)
    if (lit <= cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JGE_REG]: (cpu) => {
    const [reg, addr] = cpu.fetchOperands(OPCODES.JGE_REG)
    if (cpu.readReg(reg) >= cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },
  [OPCODES.JGE_LIT]: (cpu) => {
    const [lit, addr] = cpu.fetchOperands(OPCODES.JGE_LIT)
    if (lit >= cpu.readReg(regIndex('acc'))) {
      cpu.writeReg(regIndex('ip'), addr)
    }
  },

  // subroutines
  [OPCODES.CAL_LIT]: (cpu) => {
    const [addr] = cpu.fetchOperands(OPCODES.CAL_LIT)
    cpu.pushState()
    cpu.writeReg(regIndex('ip'), addr)
  },
  [OPCODES.CAL_REG]: (cpu) => {
    const [src] = cpu.fetchOperands(OPCODES.CAL_REG)
    cpu.pushState()
    cpu.writeReg(regIndex('ip'), cpu.readReg(src))
  },
  [OPCODES.RET]: (cpu) => {
    cpu.popState()
  },

  // interrupts
  [OPCODES.INT]: (cpu) => {
    const [value] = cpu.fetchOperands(OPCODES.INT)
    cpu.handleInterrupt(value)
  },
  [OPCODES.RET_INT]: (cpu) => {
    cpu.inISR = false
    cpu.popState()
  },

  // misc
  [OPCODES.NO_OP]: () => {},
  [OPCODES.HLT]: () => true,
}

export default CPU
