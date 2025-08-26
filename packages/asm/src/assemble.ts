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
import type { ArgNode } from './parser/types'

export type SourceSpan = { start: number; end: number }

export type SourceEntry =
  | { kind: 'instruction'; loc: SourceSpan; addr: number; size: number }
  | { kind: 'label'; loc: SourceSpan; name: string; addr: number }
  | { kind: 'const'; loc: SourceSpan; name: string; value: number }
  | { kind: 'struct'; loc: SourceSpan; name: string }
  | {
      kind: 'member'
      loc: SourceSpan
      struct: string
      name: string
      offset: number
      size: 1 | 2
    }
  | {
      kind: 'data'
      loc: SourceSpan
      name: string
      addr: number
      size: number
      elemSize: 1 | 2
      count: number
    }

export type DefInfo =
  | { kind: 'label'; loc: SourceSpan; addr: number }
  | { kind: 'const'; loc: SourceSpan }
  | { kind: 'data'; loc: SourceSpan; addr: number }
  | { kind: 'struct'; loc: SourceSpan }
  | { kind: 'member'; loc: SourceSpan; struct: string }

export type DefIndex = Record<string, DefInfo>

export type AssembleResult = {
  bytes: number[]
  symbols: Record<string, number>
  diags: AssembleDiags
  sourceMap: SourceEntry[]
  defs: DefIndex
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
            location: { offset: parsed.index ?? 0 },
          }),
        ],
      },
      sourceMap: [],
      defs: {},
    }
  }

  const ast = parsed.result
  const bytes: number[] = []
  const symbols: Symbols = {}
  const structs: Structs = {}
  const diags: AssembleDiags = { errors: [] }
  const sourceMap: SourceEntry[] = []
  const defs: DefIndex = {}
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
              location: { offset: node.loc.start },
            })
          )
          // Continue processing - don't add duplicate values
        } else {
          symbols[node.value] = currentAddr
          defs[node.value] = {
            kind: 'label',
            loc: node.loc,
            addr: currentAddr,
          }
          sourceMap.push({
            kind: 'label',
            loc: node.loc,
            name: node.value,
            addr: currentAddr,
          })
        }
        break
      case 'CONSTANT':
        if (node.name in symbols || node.name in structs) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.ConstExists,
              message: `Cannot create constant "${node.name}". A binding with this name already exists`,
              location: { offset: node.loc.start },
            })
          )
          // Continue processing - don't add duplicate symbol
        } else {
          const val = u16(node.value.value)
          symbols[node.name] = val
          defs[node.name] = { kind: 'const', loc: node.loc }
          sourceMap.push({
            kind: 'const',
            loc: node.loc,
            name: node.name,
            value: val,
          })
        }
        break
      case 'STRUCT': {
        if (node.name in symbols || node.name in structs) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.StructExists,
              message: `Cannot create structure "${node.name}". A binding with this name already exists`,
              location: { offset: node.loc.start },
            })
          )
          // Continue processing - don't add duplicate struct
        } else {
          defs[node.name] = { kind: 'struct', loc: node.loc }
          sourceMap.push({ kind: 'struct', loc: node.loc, name: node.name })
          structs[node.name] = {
            members: {},
          }

          let offset = 0
          for (const { key, value: member } of node.members) {
            const size = u16(member.value) as 1 | 2
            sourceMap.push({
              kind: 'member',
              loc: { start: member.loc.start, end: member.loc.end },
              struct: node.name,
              name: key,
              offset,
              size,
            })
            defs[`${node.name}.${key}`] = {
              kind: 'member',
              loc: { start: member.loc.start, end: member.loc.end },
              struct: node.name,
            }

            const struct = structs[node.name]!
            struct.members[key] = {
              offset,
              size: u16(member.value),
            }
            offset += size
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
              location: { offset: node.loc.start },
            })
          )
          // Continue processing - don't add duplicate symbol
        } else {
          const elemSize: 1 | 2 = node.size === 16 ? 2 : 1
          const count = node.values.length
          const size = count * elemSize
          symbols[node.name] = currentAddr
          defs[node.name] = { kind: 'data', loc: node.loc, addr: currentAddr }
          sourceMap.push({
            kind: 'data',
            loc: node.loc,
            name: node.name,
            addr: currentAddr,
            size,
            elemSize,
            count,
          })
          currentAddr += size
        }
        break
      }
      case 'INSTRUCTION': {
        const meta = OPCODES_BY_NAME[node.opcode]
        if (!meta) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.UnsupportedNode,
              message: `Unknown opcode "${node.opcode}"`,
              location: { offset: node.loc.start },
            })
          )
          // Skip this instruction but continue processing
          break
        }
        sourceMap.push({
          kind: 'instruction',
          loc: node.loc,
          addr: currentAddr,
          size: meta.size,
        })
        currentAddr += meta.size
        break
      }
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
              location: { offset: node.loc.start },
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
              location: { offset: node.loc.start },
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
              location: { offset: node.loc.start },
            })
          )
          return 0 // Fallback value
        }

        if (!(node.symbol in symbols)) {
          pushError(
            makeAssembleError({
              code: AssembleErrorCode.UnresolvedSymbol,
              message: `Symbol "${node.symbol}" was not resolved`,
              location: { offset: node.loc.start },
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
                location: { offset: node.loc.start },
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
            location: {
              offset: (node as { loc?: { start?: number } }).loc?.start ?? 0,
            },
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
          location: { offset: node.loc.start },
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
            location: { offset: node.loc.start },
          })
        )
        break
    }
  }

  return { bytes, symbols, diags, sourceMap, defs }
}
