export enum OpType {
  Reg,
  Imm8,
  Imm16,
  Addr,
}

export enum OpcodeForm {
  NO_ARGS = 'noArgs',
  SINGLE_REG = 'singleReg',
  SINGLE_IMM = 'singleImm',
  SINGLE_MEM = 'singleMem',
  IMM_REG = 'immReg',
  REG_IMM = 'regImm',
  REG_REG = 'regReg',
  REG_MEM = 'regMem',
  MEM_REG = 'memReg',
  IMM_MEM = 'immMem',
  IMM8_REG = 'imm8Reg',
  IMM_REG_PTR = 'immRegPtr',
  REG_PTR_REG = 'regPtrReg',
  REG_REG_PTR = 'regRegPtr',
  IMM_OFF_REG = 'immOffReg',
}

export const OPERAND_SIZE: Record<OpType, number> = {
  [OpType.Reg]: 1,
  [OpType.Imm8]: 1,
  [OpType.Imm16]: 2,
  [OpType.Addr]: 2,
}

interface RawOpcode {
  code: number
  name: string
  keyword: string
  form: OpcodeForm
  schema: readonly OpType[]
}

export interface OpcodeMeta extends RawOpcode {
  size: number
}

function sizeFromSchema(schema: readonly OpType[]): number {
  return 1 + schema.reduce((sum, t) => sum + OPERAND_SIZE[t], 0)
}

function withMeta<const D extends RawOpcode>(def: D): OpcodeMeta {
  return {
    ...def,
    size: sizeFromSchema(def.schema),
  }
}

const RAW_OPCODES = [
  {
    code: 0x10,
    name: 'MOV_IMM_REG',
    keyword: 'mov',
    schema: [OpType.Imm16, OpType.Reg],
    form: OpcodeForm.IMM_REG,
  },
  {
    code: 0x11,
    name: 'MOV_REG_REG',
    keyword: 'mov',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },
  {
    code: 0x12,
    name: 'MOV_REG_MEM',
    keyword: 'mov',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x13,
    name: 'MOV_MEM_REG',
    keyword: 'mov',
    schema: [OpType.Addr, OpType.Reg],
    form: OpcodeForm.MEM_REG,
  },
  {
    code: 0x14,
    name: 'MOV_IMM_MEM',
    keyword: 'mov',
    schema: [OpType.Imm16, OpType.Addr],
    form: OpcodeForm.IMM_MEM,
  },
  {
    code: 0x15,
    name: 'MOV_REG_PTR_REG',
    keyword: 'mov',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_PTR_REG,
  },
  {
    code: 0x16,
    name: 'MOV_REG_REG_PTR',
    keyword: 'mov',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG_PTR,
  },
  {
    code: 0x17,
    name: 'MOV_IMM_OFF_REG',
    keyword: 'mov',
    schema: [OpType.Addr, OpType.Reg, OpType.Reg],
    form: OpcodeForm.IMM_OFF_REG,
  },
  {
    code: 0x70,
    name: 'MOV8_IMM_REG',
    keyword: 'mov8',
    schema: [OpType.Imm8, OpType.Reg],
    form: OpcodeForm.IMM8_REG,
  },
  {
    code: 0x71,
    name: 'MOV8_MEM_REG',
    keyword: 'mov8',
    schema: [OpType.Addr, OpType.Reg],
    form: OpcodeForm.MEM_REG,
  },
  {
    code: 0x72,
    name: 'MOVL_REG_MEM',
    keyword: 'lmov',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x73,
    name: 'MOVH_REG_MEM',
    keyword: 'hmov',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x74,
    name: 'MOV8_REG_PTR_REG',
    keyword: 'mov8',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_PTR_REG,
  },
  {
    code: 0x75,
    name: 'MOV8_REG_REG_PTR',
    keyword: 'mov8',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG_PTR,
  },
  {
    code: 0x76,
    name: 'MOV_IMM_REG_PTR',
    keyword: 'mov',
    schema: [OpType.Imm16, OpType.Reg],
    form: OpcodeForm.IMM_REG_PTR,
  },
  {
    code: 0x18,
    name: 'PSH_IMM',
    keyword: 'push',
    schema: [OpType.Imm16],
    form: OpcodeForm.SINGLE_IMM,
  },
  {
    code: 0x19,
    name: 'PSH_REG',
    keyword: 'push',
    schema: [OpType.Reg],
    form: OpcodeForm.SINGLE_REG,
  },
  {
    code: 0x1a,
    name: 'POP',
    keyword: 'pop',
    schema: [OpType.Reg],
    form: OpcodeForm.SINGLE_REG,
  },

  {
    code: 0x1b,
    name: 'ADD_IMM_REG',
    keyword: 'add',
    schema: [OpType.Imm16, OpType.Reg],
    form: OpcodeForm.IMM_REG,
  },
  {
    code: 0x1c,
    name: 'ADD_REG_REG',
    keyword: 'add',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },

  {
    code: 0x1d,
    name: 'SUB_IMM_REG',
    keyword: 'sub',
    schema: [OpType.Imm16, OpType.Reg],
    form: OpcodeForm.IMM_REG,
  },
  {
    code: 0x1e,
    name: 'SUB_REG_IMM',
    keyword: 'sub',
    schema: [OpType.Reg, OpType.Imm16],
    form: OpcodeForm.REG_IMM,
  },
  {
    code: 0x1f,
    name: 'SUB_REG_REG',
    keyword: 'sub',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },

  {
    code: 0x20,
    name: 'MUL_IMM_REG',
    keyword: 'mul',
    schema: [OpType.Imm16, OpType.Reg],
    form: OpcodeForm.IMM_REG,
  },
  {
    code: 0x21,
    name: 'MUL_REG_REG',
    keyword: 'mul',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },
  {
    code: 0x26,
    name: 'LSH_REG_IMM',
    keyword: 'lsh',
    schema: [OpType.Reg, OpType.Imm16],
    form: OpcodeForm.REG_IMM,
  },
  {
    code: 0x27,
    name: 'LSH_REG_REG',
    keyword: 'lsh',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },
  {
    code: 0x2a,
    name: 'RSH_REG_IMM',
    keyword: 'rsh',
    schema: [OpType.Reg, OpType.Imm16],
    form: OpcodeForm.REG_IMM,
  },
  {
    code: 0x2b,
    name: 'RSH_REG_REG',
    keyword: 'rsh',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },
  {
    code: 0x2e,
    name: 'AND_REG_IMM',
    keyword: 'and',
    schema: [OpType.Reg, OpType.Imm16],
    form: OpcodeForm.REG_IMM,
  },
  {
    code: 0x2f,
    name: 'AND_REG_REG',
    keyword: 'and',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },
  {
    code: 0x30,
    name: 'OR_REG_IMM',
    keyword: 'or',
    schema: [OpType.Reg, OpType.Imm16],
    form: OpcodeForm.REG_IMM,
  },
  {
    code: 0x31,
    name: 'OR_REG_REG',
    keyword: 'or',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },
  {
    code: 0x32,
    name: 'XOR_REG_IMM',
    keyword: 'xor',
    schema: [OpType.Reg, OpType.Imm16],
    form: OpcodeForm.REG_IMM,
  },
  {
    code: 0x33,
    name: 'XOR_REG_REG',
    keyword: 'xor',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },
  {
    code: 0x34,
    name: 'NOT',
    keyword: 'not',
    schema: [OpType.Reg],
    form: OpcodeForm.SINGLE_REG,
  },
  {
    code: 0x35,
    name: 'INC_REG',
    keyword: 'inc',
    schema: [OpType.Reg],
    form: OpcodeForm.SINGLE_REG,
  },
  {
    code: 0x36,
    name: 'DEC_REG',
    keyword: 'dec',
    schema: [OpType.Reg],
    form: OpcodeForm.SINGLE_REG,
  },
  {
    code: 0x37,
    name: 'SWP_REG_REG',
    keyword: 'swp',
    schema: [OpType.Reg, OpType.Reg],
    form: OpcodeForm.REG_REG,
  },
  {
    code: 0x3a,
    name: 'JMP_IMM',
    keyword: 'jmp',
    schema: [OpType.Imm16],
    form: OpcodeForm.SINGLE_IMM,
  },
  {
    code: 0x3b,
    name: 'JMP_REG',
    keyword: 'jmp',
    schema: [OpType.Reg],
    form: OpcodeForm.SINGLE_REG,
  },
  {
    code: 0x3e,
    name: 'JEQ_REG',
    keyword: 'jeq',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x3f,
    name: 'JEQ_IMM',
    keyword: 'jeq',
    schema: [OpType.Imm16, OpType.Addr],
    form: OpcodeForm.IMM_MEM,
  },
  {
    code: 0x40,
    name: 'JNE_REG',
    keyword: 'jne',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x41,
    name: 'JNE_IMM',
    keyword: 'jne',
    schema: [OpType.Imm16, OpType.Addr],
    form: OpcodeForm.IMM_MEM,
  },
  {
    code: 0x42,
    name: 'JLT_REG',
    keyword: 'jlt',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x43,
    name: 'JLT_IMM',
    keyword: 'jlt',
    schema: [OpType.Imm16, OpType.Addr],
    form: OpcodeForm.IMM_MEM,
  },
  {
    code: 0x44,
    name: 'JGT_REG',
    keyword: 'jgt',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x45,
    name: 'JGT_IMM',
    keyword: 'jgt',
    schema: [OpType.Imm16, OpType.Addr],
    form: OpcodeForm.IMM_MEM,
  },
  {
    code: 0x46,
    name: 'JLE_REG',
    keyword: 'jle',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x47,
    name: 'JLE_IMM',
    keyword: 'jle',
    schema: [OpType.Imm16, OpType.Addr],
    form: OpcodeForm.IMM_MEM,
  },
  {
    code: 0x48,
    name: 'JGE_REG',
    keyword: 'jge',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x49,
    name: 'JGE_IMM',
    keyword: 'jge',
    schema: [OpType.Imm16, OpType.Addr],
    form: OpcodeForm.IMM_MEM,
  },
  {
    code: 0x4a,
    name: 'JZ_REG',
    keyword: 'jz',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x4b,
    name: 'JNZ_REG',
    keyword: 'jnz',
    schema: [OpType.Reg, OpType.Addr],
    form: OpcodeForm.REG_MEM,
  },
  {
    code: 0x5e,
    name: 'CAL_IMM',
    keyword: 'call',
    schema: [OpType.Addr],
    form: OpcodeForm.SINGLE_MEM,
  },
  {
    code: 0x5f,
    name: 'CAL_REG',
    keyword: 'call',
    schema: [OpType.Reg],
    form: OpcodeForm.SINGLE_REG,
  },
  {
    code: 0x60,
    name: 'RET',
    keyword: 'ret',
    schema: [],
    form: OpcodeForm.NO_ARGS,
  },
  {
    code: 0xfc,
    name: 'INT',
    keyword: 'int',
    schema: [OpType.Imm16],
    form: OpcodeForm.SINGLE_IMM,
  },
  {
    code: 0xfd,
    name: 'RET_INT',
    keyword: 'rti',
    schema: [],
    form: OpcodeForm.NO_ARGS,
  },
  {
    code: 0xff,
    name: 'HLT',
    keyword: 'hlt',
    schema: [],
    form: OpcodeForm.NO_ARGS,
  },
] as const satisfies readonly RawOpcode[]

export const OPCODES_TABLE = RAW_OPCODES.map(withMeta)

export type OpcodeEntry = (typeof RAW_OPCODES)[number]
export type OpcodeName = OpcodeEntry['name']
export type OpcodeKeyword = OpcodeEntry['keyword']
export type Opcode = OpcodeEntry['code']

export const OPCODES = Object.fromEntries(
  OPCODES_TABLE.map((d) => [d.name, d.code])
) as {
  [N in OpcodeName]: Extract<OpcodeEntry, { name: N }>['code']
}

export const OPCODE_METAS = Object.fromEntries(
  RAW_OPCODES.map((d) => [d.code, d])
) as {
  [C in Opcode]: Extract<OpcodeEntry, { code: C }>
}

export const OPCODES_BY_NAME = Object.fromEntries(
  OPCODES_TABLE.map((d) => [d.name, d])
) as {
  [N in OpcodeName]: OpcodeMeta
}

export type RegIndex = number & { readonly __brand: 'RegIndex' }
export type OpValue<T extends OpType> = T extends OpType.Reg
  ? RegIndex
  : T extends OpType.Addr
    ? number
    : T extends OpType.Imm8
      ? number
      : T extends OpType.Imm16
        ? number
        : never

type OperandTupleFor<S extends readonly OpType[]> = {
  [I in keyof S]: OpValue<S[I]>
}

export type OperandTuple = {
  [C in Opcode]: OperandTupleFor<(typeof OPCODE_METAS)[C]['schema']>
}
