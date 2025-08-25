import { u8, u16 } from '@gero/util'
import { OpcodeForm, OPCODES_BY_NAME } from '@gero/vm/instructions'
import { regIndex } from '@gero/vm/register'
import * as P from 'parsil'

import {
  type AssembleError,
  AssembleErrorCode,
  makeAssembleError,
} from './errors'
import parser from './parser'
import { parseOrReport } from './parser/errors'
import type { ArgNode, InstructionNode } from './parser/types'

export type AssembleResult = {
  bytes: number[]
  symbols: Record<string, number>
  diags: AssembleDiags
}

export type AssembleDiags = {
  errors: AssembleError[]
}

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

export function assemble(source: string): AssembleResult {
  // Parse first - if parse fails, we can't continue
  const parsed = parseOrReport(parser, source)
  if (!parsed.ok) {
    return {
      bytes: [],
      symbols: {},
      diags: {
        errors: [
          makeAssembleError({
            code: AssembleErrorCode.Parse,
            message: parsed.message,
          }),
        ],
      },
    }
  }

  const ast = parsed.result
  const bytes: number[] = []
  const symbols: Symbols = {}
  const structs: Structs = {}
  const diags: AssembleDiags = { errors: [] }
  let currentAddr = 0

  // Helper to add errors to diagnostics
  const pushError = (error: AssembleError) => {
    diags.errors.push(error)
  }

  // pass 1: collect symbol addresses and compute sizes
  // Continue processing even when errors occur
  for (const node of ast) {
    switch (node.type) {
      case 'LABEL':
        if (node.value in symbols || node.value in structs) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.LabelExists,
              message: `Cannot create label "${node.value}". A binding with this name already exists`,
            })
          )
          // Continue processing - don't add duplicate symbol
        } else {
          symbols[node.value] = currentAddr
        }
        break
      case 'CONSTANT':
        if (node.name in symbols || node.name in structs) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.ConstExists,
              message: `Cannot create constant "${node.name}". A binding with this name already exists`,
            })
          )
          // Continue processing - don't add duplicate symbol
        } else {
          symbols[node.name] = u16(node.value.value)
        }
        break
      case 'STRUCT': {
        if (node.name in symbols || node.name in structs) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.StructExists,
              message: `Cannot create structure "${node.name}". A binding with this name already exists`,
            })
          )
          // Continue processing - don't add duplicate struct
        } else {
          structs[node.name] = {
            members: {},
          }

          let offset = 0
          for (const { key, value: member } of node.members) {
            const struct = structs[node.name]!
            struct.members[key] = {
              offset,
              size: u16(member.value),
            }
            offset += struct.members[key].size
          }
        }
        break
      }
      case 'DATA': {
        if (node.name in symbols || node.name in structs) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.TableExists,
              message: `Cannot create table "${node.name}". A binding with this name already exists`,
            })
          )
          // Continue processing - don't add duplicate symbol
        } else {
          symbols[node.name] = currentAddr
          const valueSize = node.size === 16 ? 2 : 1
          currentAddr += node.values.length * valueSize
        }
        break
      }
      case 'INSTRUCTION':
        currentAddr += OPCODES_BY_NAME[(node as InstructionNode).opcode].size
        break
    }
  }

  // Helper function that adds errors to diags and returns fallback value
  const getNodeValue = (node: P.Ok<ArgNode>['result']): number => {
    switch (node.type) {
      case 'ADDR_LITERAL':
      case 'HEX_LITERAL':
        return node.value
      case 'VARIABLE': {
        if (!(node.value in symbols)) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.UnresolvedLabel,
              message: `label "${node.value}" was not resolved`,
            })
          )
          return 0 // Fallback value to continue processing
        }
        return symbols[node.value] as number
      }
      case 'CAST': {
        const struct = structs[node.structure]
        if (!struct) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.UnresolvedStruct,
              message: `Structure "${node.structure}" was not resolved`,
            })
          )
          return 0 // Fallback value
        }

        const member = struct.members[node.property]
        if (!member) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.UnresolvedProperty,
              message: `Property "${node.property}" in structure "${node.structure}" was not resolved`,
            })
          )
          return 0 // Fallback value
        }

        if (!(node.symbol in symbols)) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.UnresolvedSymbol,
              message: `Symbol "${node.symbol}" was not resolved`,
            })
          )
          return 0 // Fallback value
        }
        const symbol = symbols[node.symbol]!
        return symbol + member.offset
      }
      case 'REGISTER':
      case 'REGISTER_PTR':
        return regIndex(node.value)
      case 'ADDRESS': {
        return getNodeValue(node.expr)
      }
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
          default:
            pushError(
              makeAssembleError({
                code: AssembleErrorCode.UnsupportedNode,
                message: `Unsupported binary operator`,
              })
            )
            return 0 // Fallback value
        }
      }
      default:
        pushError(
          makeAssembleError({
            code: AssembleErrorCode.UnsupportedNode,
            message: `Unsupported node ${node.type}`,
          })
        )
        return 0 // Fallback value
    }
  }

  // Helper functions for encoding - continue on errors with fallback bytes
  const encImmOrMem = (node: ArgNode): void => {
    const hex = getNodeValue(node)
    const high = (hex & 0xff00) >> 8
    const low = hex & 0x00ff
    bytes.push(high, low)
  }

  const encImm8 = (node: ArgNode): void => {
    const hex = getNodeValue(node)
    bytes.push(u8(hex))
  }

  const encReg = (node: ArgNode): void => {
    const reg = getNodeValue(node)
    bytes.push(u8(reg))
  }

  // pass 2: encode - continue processing even when errors occur
  for (const node of ast) {
    if (
      node.type === 'LABEL' ||
      node.type === 'CONSTANT' ||
      node.type === 'STRUCT'
    ) {
      continue
    }

    if (node.type === 'DATA') {
      if (node.size === 8) {
        for (const b of node.values) bytes.push(u8(b.value))
      } else {
        for (const w of node.values) bytes.push(u8(w.value >>> 8), u8(w.value))
      }
      continue
    }

    // Check if instruction opcode is valid
    const meta = OPCODES_BY_NAME[node.opcode]
    if (!meta) {
      pushError(
        makeAssembleError({
          code: AssembleErrorCode.UnsupportedNode,
          message: `Unknown opcode "${node.opcode}"`,
        })
      )
      // Skip this instruction but continue processing
      continue
    }

    bytes.push(meta.code)
    const args = node.args

    // Continue encoding arguments even if some fail
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
      default:
        pushError(
          makeAssembleError({
            code: AssembleErrorCode.UnsupportedNode,
            message: `Unsupported opcode form ${meta.form}`,
          })
        )
        break
    }
  }

  return { bytes, symbols, diags }
}
