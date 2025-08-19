import * as P from 'parsil'
import parser from './parser'
import { deepLog } from './parser/util/deep-log'
import type { ArgNode, DataNode, InstructionNode } from './parser/types'
import { regIndex } from '../vm/register'
import {
  OpcodeForm,
  OPCODES_BY_NAME,
  type OpcodeName,
} from '../vm/instructions'
import { parseOrExit } from './parser/errors'
import { printHexTable } from './util'

const program = [
  'const cafe = $CAFE',
  'const loc = $0050',
  '',
  '+data8 bytes = { $BE, $EF }',
  'data16 words = {$BABA, $DEAD}',
  '',
  'start:',
  '   mov !cafe, &[$20 + ($03 * $10)]',
  '',
  'loop:',
  '   mov &[!loc], acc',
  '   dec acc',
  '   mov acc, &[!loc]',
  '   inc r2',
  '   inc r2',
  '   inc r2',
  '   jne $00, &[!loop]',
  'end:',
  '   hlt',
].join('\n')

const out = parseOrExit(parser, program)

deepLog(out, {
  maxDepth: Infinity,
})

const code: number[] = []
const symbols: Record<string, number> = {}
let currentAddr = 0

out.forEach((node) => {
  switch (node.type) {
    case 'LABEL':
      symbols[node.value] = currentAddr
      break
    case 'CONSTANT':
      symbols[node.name] = node.value.value & 0xffff
      break
    case 'DATA':
      symbols[node.name] = currentAddr
      const valueSize = node.size === 16 ? 2 : 1
      const totalSize = node.values.length * valueSize
      currentAddr += totalSize
      break
    case 'INSTRUCTION':
      const meta = OPCODES_BY_NAME[(node as InstructionNode).opcode]
      currentAddr += meta.size
      break
  }
})

type Encoder<T> = (node: P.Ok<T>['result']) => number | void

function getNodeValue(node: P.Ok<ArgNode>['result']): number {
  switch (node.type) {
    case 'ADDR_LITERAL':
    case 'HEX_LITERAL':
      return node.value
    case 'VARIABLE': {
      if (!(node.value in symbols)) {
        throw new Error(`label "${node.value}" was not resolved`)
      }
      return symbols[node.value] as number
    }
    case 'REGISTER':
    case 'REGISTER_PTR':
      return regIndex(node.value)
    case 'ADDRESS':
      return getNodeValue(node.expr)
    case 'BINARY_OP': {
      const a = getNodeValue(node.a)
      const b = getNodeValue(node.b)

      let res: number
      switch (node.op.type) {
        case 'PLUS':
          res = a + b
          break
        case 'MINUS':
          res = a - b
          break
        case 'FACTOR':
          res = a * b
          break
      }

      return res
    }
    default:
      throw new Error(`Not a valid node`)
  }
}

const encodeImmOrMem: Encoder<ArgNode> = (node) => {
  const hex = getNodeValue(node)
  const high = (hex & 0xff00) >> 8
  const low = hex & 0x00ff

  code.push(high, low)
}

const encodeImm8: Encoder<ArgNode> = (node) => {
  const hex = getNodeValue(node)
  const byte = hex & 0x00ff
  code.push(byte)
}

const encodeRegOrRegPtr: Encoder<ArgNode> = (node) => {
  const reg = getNodeValue(node)
  code.push(reg)
}

function assertOneArg(
  args: ArgNode[],
  opcode: OpcodeName
): asserts args is [ArgNode] {
  if (args.length !== 1)
    throw new Error(`${opcode}: expected 1 arg, got ${args.length}`)
}

function assertTwoArgs(
  args: ArgNode[],
  opcode: OpcodeName
): asserts args is [ArgNode, ArgNode] {
  if (args.length !== 2)
    throw new Error(`${opcode}: expected 2 arg, got ${args.length}`)
}

function assertThreeArgs(
  args: ArgNode[],
  opcode: OpcodeName
): asserts args is [ArgNode, ArgNode, ArgNode] {
  if (args.length !== 3)
    throw new Error(`${opcode}: expected 3 arg, got ${args.length}`)
}

function encodeOpcode(node: InstructionNode) {
  const { args, opcode } = node
  const meta = OPCODES_BY_NAME[opcode]
  code.push(meta.code)

  switch (meta.form) {
    case OpcodeForm.NO_ARGS:
      break
    case OpcodeForm.SINGLE_MEM:
    case OpcodeForm.SINGLE_IMM:
      assertOneArg(args, opcode)
      encodeImmOrMem(args[0])
      break
    case OpcodeForm.SINGLE_REG:
      assertOneArg(args, opcode)
      encodeRegOrRegPtr(args[0])
      break
    case OpcodeForm.IMM8_MEM:
      assertTwoArgs(args, opcode)
      encodeImm8(args[0])
      encodeImmOrMem(args[1])
      break
    case OpcodeForm.IMM_REG:
    case OpcodeForm.MEM_REG:
      assertTwoArgs(args, opcode)
      encodeImmOrMem(args[0])
      encodeRegOrRegPtr(args[1])
      break
    case OpcodeForm.REG_MEM:
    case OpcodeForm.REG_IMM:
      assertTwoArgs(args, opcode)
      encodeRegOrRegPtr(args[0])
      encodeImmOrMem(args[1])
      break
    case OpcodeForm.REG_REG:
    case OpcodeForm.REG_PTR_REG:
      assertTwoArgs(args, opcode)
      for (const arg of args) encodeRegOrRegPtr(arg)
      break
    case OpcodeForm.IMM_MEM:
      assertTwoArgs(args, opcode)
      for (const arg of args) encodeImmOrMem(arg)
      break
    case OpcodeForm.IMM_OFF_REG:
      assertThreeArgs(args, opcode)
      encodeImmOrMem(args[0])
      encodeRegOrRegPtr(args[1])
      encodeRegOrRegPtr(args[2])
      break
  }
}

function encodeData8(node: DataNode) {
  for (const byte of node.values) {
    code.push(byte.value & 0xff)
  }
}

function encodeData16(node: DataNode) {
  for (const word of node.values) {
    code.push((word.value & 0xff00) >> 8)
    code.push(word.value & 0xff)
  }
}

out.forEach((node) => {
  if (node.type === 'LABEL' || node.type === 'CONSTANT') {
    return
  }
  if (node.type === 'DATA') {
    if (node.size === 8) {
      encodeData8(node)
    } else {
      encodeData16(node)
    }

    return
  }
  encodeOpcode(node)
})

printHexTable(code)
