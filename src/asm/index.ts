import * as P from 'parsil'
import parser from './parser'
import { deepLog } from './parser/util/deep-log'
import type {
  ArgNode,
  EncodableNode,
  InstructionNode,
  OperandNode,
} from './parser/types'
import { regIndex } from '../vm/register'
import {
  OpcodeForm,
  OPCODES_BY_NAME,
  type OpcodeName,
} from '../vm/instructions'
import { fmt8 } from '../vm/util'

const program = [
  'mov [$2200 + ($1000 * $02)], r1 ',
  'mov r1, &0060',
  'mov $1300, r1',
  'mov &0060, r2',
  'add r1, r2',
  'hlt',
].join('\n')

const out = parser.run(program)

if (out.isError) {
  throw new Error(out.error)
}

deepLog(out.result, {
  maxDepth: Infinity,
})

const code: number[] = []

type Encoder<T> = (node: P.Ok<T>['result']) => number | void

function getNodeValue(
  node: P.Ok<EncodableNode | OperandNode>['result']
): number {
  switch (node.type) {
    case 'ADDR_LITERAL':
    case 'HEX_LITERAL':
      return node.value
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

out.result.forEach((node) => encodeOpcode(node))

console.log(code.map((b) => fmt8(b)))
