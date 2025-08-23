import { OpcodeForm, OPCODES_BY_NAME } from '@gero/vm/instructions'
import { regIndex } from '@gero/vm/register'
import * as P from 'parsil'

import { AssembleError } from './errors'
import parser from './parser'
import { parseOrExit, parseOrReport } from './parser/errors'
import type { ArgNode, InstructionNode } from './parser/types'

export type AssembleResult = {
  bytes: number[]
  symbols: Record<string, number>
}
export type AssembleOptions = { onError?: 'throw' | 'exit' }

export type Symbols = Record<string, number>
export type Structs = {
  [k: string]: {
    members: {
      [k: string]: {
        offset: number
        size: number
      }
    }
  }
}

export function assemble(
  source: string,
  opts: AssembleOptions = {}
): AssembleResult {
  const { onError = 'exit' } = opts

  const out =
    onError === 'exit'
      ? parseOrExit(parser, source)
      : (() => {
          const r = parseOrReport(parser, source)
          if (!r.ok) throw new AssembleError('PARSE', r.message)
          return r.result
        })()

  const bytes: number[] = []
  const symbols: Symbols = {}
  const structs: Structs = {}
  let currentAddr = 0

  // pass 1: collect symbol addresses and compute sizes
  out.forEach((node) => {
    switch (node.type) {
      case 'LABEL':
        if (node.value in symbols || node.value in structs) {
          throw new AssembleError(
            'LABEL_EXISTS',
            `Cannot create label "${node.value}". A binding with this name already exists`
          )
        }

        symbols[node.value] = currentAddr
        break
      case 'CONSTANT':
        if (node.name in symbols || node.name in structs) {
          throw new AssembleError(
            'CONST_EXISTS',
            `Cannot create constant "${node.name}". A binding with this name already exists`
          )
        }

        symbols[node.name] = node.value.value & 0xffff
        break
      case 'STRUCT': {
        if (node.name in symbols || node.name in structs) {
          throw new AssembleError(
            'STRUCT_EXISTS',
            `Cannot create structure "${node.name}". A binding with this name already exists`
          )
        }

        structs[node.name] = {
          members: {},
        }

        let offset = 0
        for (const { key, value: member } of node.members) {
          const struct = structs[node.name]!
          struct.members[key] = {
            offset,
            size: member.value & 0xffff,
          }
          offset += struct.members[key].size
        }
        break
      }
      case 'DATA': {
        if (node.name in symbols || node.name in structs) {
          throw new AssembleError(
            'TABLE_EXISTS',
            `Cannot create table "${node.name}". A binding with this name already exists`
          )
        }

        symbols[node.name] = currentAddr
        const valueSize = node.size === 16 ? 2 : 1
        currentAddr += node.values.length * valueSize
        break
      }
      case 'INSTRUCTION':
        currentAddr += OPCODES_BY_NAME[(node as InstructionNode).opcode].size
        break
    }
  })

  // helpers
  const getNodeValue = (node: P.Ok<ArgNode>['result']): number => {
    switch (node.type) {
      case 'ADDR_LITERAL':
      case 'HEX_LITERAL':
        return node.value
      case 'VARIABLE': {
        if (!(node.value in symbols)) {
          throw new AssembleError(
            'UNRESOLVED_LABEL',
            `label "${node.value}" was not resolved`
          )
        }
        return symbols[node.value] as number
      }
      case 'CAST': {
        const struct = structs[node.structure]
        if (!struct)
          throw new AssembleError(
            'UNRESOLVED_STRUCT',
            `Structure "${node.structure}" was not resolved`
          )

        const member = struct.members[node.property]
        if (!member)
          throw new AssembleError(
            'UNRESOLVED_PROPERTY',
            `Property "${node.property}" in structure "${node.structure}" was not resolved`
          )

        if (!(node.symbol in symbols))
          throw new AssembleError(
            'UNRESOLVED_SYMBOL',
            `Symbol "${node.symbol}" was not resolved`
          )
        const symbol = symbols[node.symbol]!

        return symbol + member.offset
      }
      case 'REGISTER':
      case 'REGISTER_PTR':
        return regIndex(node.value)
      case 'ADDRESS':
        return getNodeValue(node.expr)
      case 'BINARY_OP': {
        const lhs = getNodeValue(node.lhs)
        const rhs = getNodeValue(node.rhs)
        switch (node.op.type) {
          case 'PLUS':
            return lhs + rhs
          case 'MINUS':
            return lhs - rhs
          case 'FACTOR':
            return lhs * rhs
        }
      }
    }
    throw new AssembleError('UNSUPPORTED_NODE', `Unsupported node ${node.type}`)
  }

  const encImmOrMem = (node: ArgNode) => {
    const hex = getNodeValue(node)
    const high = (hex & 0xff00) >> 8
    const low = hex & 0x00ff
    bytes.push(high, low)
  }
  const encImm8 = (node: ArgNode) => {
    const hex = getNodeValue(node)
    bytes.push(hex & 0xff)
  }
  const encReg = (node: ArgNode) => {
    const reg = getNodeValue(node)
    bytes.push(reg & 0xff)
  }

  // pass 2: encode
  out.forEach((node) => {
    if (
      node.type === 'LABEL' ||
      node.type === 'CONSTANT' ||
      node.type === 'STRUCT'
    )
      return
    if (node.type === 'DATA') {
      if (node.size === 8) {
        for (const b of node.values) bytes.push(b.value & 0xff)
      } else {
        for (const w of node.values)
          bytes.push((w.value >>> 8) & 0xff, w.value & 0xff)
      }
      return
    }

    const meta = OPCODES_BY_NAME[node.opcode]
    bytes.push(meta.code)
    const args = node.args
    switch (meta.form) {
      case OpcodeForm.NO_ARGS:
        break
      case OpcodeForm.SINGLE_MEM:
      case OpcodeForm.SINGLE_IMM:
        encImmOrMem(args[0]!)
        break
      case OpcodeForm.SINGLE_REG:
        encReg(args[0]!)
        break
      case OpcodeForm.IMM8_REG:
        encImm8(args[0]!)
        encReg(args[1]!)
        break
      case OpcodeForm.IMM_REG:
      case OpcodeForm.MEM_REG:
        encImmOrMem(args[0]!)
        encReg(args[1]!)
        break
      case OpcodeForm.REG_MEM:
      case OpcodeForm.REG_IMM:
        encReg(args[0]!)
        encImmOrMem(args[1]!)
        break
      case OpcodeForm.REG_REG:
      case OpcodeForm.REG_PTR_REG:
      case OpcodeForm.REG_REG_PTR:
        encReg(args[0]!)
        encReg(args[1]!)
        break
      case OpcodeForm.IMM_MEM:
        encImmOrMem(args[0]!)
        encImmOrMem(args[1]!)
        break
      case OpcodeForm.IMM_REG_PTR:
        encImmOrMem(args[0]!)
        encReg(args[1]!)
        break
      case OpcodeForm.IMM_OFF_REG:
        encImmOrMem(args[0]!)
        encReg(args[1]!)
        encReg(args[2]!)
        break
    }
  })

  return { bytes, symbols }
}
