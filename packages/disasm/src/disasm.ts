import { fmt8, u8, u16 } from '@gero/util'
import {
  type Opcode,
  OPCODE_METAS,
  type OpcodeName,
  OpType,
  REGISTER_NAMES,
} from '@gero/vm'

import { type DisasmError, DisasmErrorCode, makeDisasmError } from './errors'
import { err, ok, type Result } from './result'
import { type ByteSource } from './source'
import type {
  ArgNode,
  DisasmDiags,
  DisasmNode,
  DisasmOptions,
  DisasmResult,
  RegionHint,
  Span,
} from './types'

export function disassemble(
  src: ByteSource,
  opts: DisasmOptions = {}
): DisasmResult {
  const spans: Span[] = []
  const base = opts.baseAddr ?? 0x0000
  const limit = Math.min(src.length, opts.maxBytes ?? src.length)
  const diags: DisasmDiags = { errors: [] }
  const maxInstrs = opts.maxInstrs ?? Infinity
  const codeOnly = !!opts.codeOnly

  let off = 0
  let spanCount = 0
  let codeCount = 0
  let skippedRun = 0
  let skippedStart = 0

  const underLimit = () => (codeOnly ? codeCount : spanCount) < maxInstrs

  while (off < limit && underLimit()) {
    const addr = u16(base + off)
    const mark = findRegionMark(opts.regions, addr)

    // Explicit marks first
    if (mark) {
      // In code-only mode: skip non-code regions without emitting anything
      if (codeOnly && mark.type !== 'code') {
        const skip = Math.min(remainingInRegion(mark, addr), limit - off)
        off += skip
        continue
      }

      switch (mark.type) {
        case 'code': {
          const insR = decodeOne(src, off, base)
          if (insR.ok) {
            const node = insR.value
            spans.push({
              kind: 'code',
              addr,
              bytes: node.bytes,
              size: node.size,
              node,
            })
            off += node.size
            codeCount++
            spanCount++
          } else {
            pushDiag(diags, insR.error)
            if (opts.strict) {
              return { start: base, end: u16(base + off), spans, diags }
            }

            if (codeOnly) {
              // resync without emitting data
              off += 1
            } else {
              const b = readByte(src, off)
              if (b.ok) {
                spans.push(u8Fallback(addr, b.value))
                off += 1
                spanCount++
              } else {
                pushDiag(diags, b.error)
                return { start: base, end: u16(base + off), spans, diags }
              }
            }
          }

          continue
        }

        case 'u8': {
          const b = readByte(src, off)
          if (!b.ok) {
            pushDiag(diags, b.error)
            return { start: base, end: u16(base + off), spans, diags }
          }

          spans.push(u8Fallback(addr, b.value))
          off += 1
          spanCount++
          continue
        }

        case 'u16': {
          const w = readWord(src, off)
          if (!w.ok) {
            pushDiag(diags, w.error)
            const b = readByte(src, off)
            if (b.ok) {
              spans.push(u8Fallback(addr, b.value))
              off += 1
              spanCount++
              continue
            }

            return { start: base, end: u16(base + off), spans, diags }
          }

          spans.push({ kind: 'u16', addr, size: 2, value: w.value })
          off += 2
          spanCount++
          continue
        }

        case 'table8': {
          const rem = remainingInRegion(mark, addr)
          const take = Math.min(rem, limit - off)
          const values: number[] = []

          for (let k = 0; k < take; k++) {
            const r = readByte(src, off + k)
            if (!r.ok) {
              pushDiag(diags, r.error)
              // cut the table at first failure
              break
            }
            values.push(u8(r.value))
          }

          spans.push({ kind: 'table8', addr, size: values.length, values })
          off += values.length
          spanCount++
          continue
        }

        case 'table16': {
          const rem = remainingInRegion(mark, addr)
          const raw = Math.min(rem, limit - off)
          const even = raw & ~1
          const values: number[] = []

          for (let k = 0; k < even; k += 2) {
            const w = readWord(src, off + k)
            if (!w.ok) {
              pushDiag(diags, w.error)
              break
            }
            values.push(w.value)
          }

          spans.push({ kind: 'table16', addr, size: values.length * 2, values })
          off += values.length * 2
          spanCount++
          continue
        }
      }
    }

    // no explicit mark -> try to decode code
    const insR = decodeOne(src, off, base)
    if (insR.ok) {
      const node = insR.value
      spans.push({
        kind: 'code',
        addr,
        bytes: node.bytes,
        size: node.size,
        node,
      })
      off += node.size
      codeCount++
      spanCount++

      if (codeOnly && opts.codeOnlyDiag === 'aggregate' && skippedRun > 0) {
        ;(diags.skipped ??= []).push({
          start: skippedStart,
          end: addr,
          count: skippedRun,
        })
        skippedRun = 0
      }

      continue
    }

    // decode failed -> record and recover (or stop in strict)
    if (opts.strict) {
      // strict always surface the real error
      pushDiag(diags, insR.error)
      return { start: base, end: u16(base + off), spans, diags }
    }

    if (codeOnly) {
      if (opts.codeOnlyDiag === 'verbose') {
        pushDiag(diags, insR.error)
      } else if (opts.codeOnlyDiag === 'aggregate') {
        if (skippedRun === 0) skippedStart = addr
        skippedRun++
      }
      off += 1
      continue
    }

    pushDiag(diags, insR.error)
    const b = readByte(src, off)
    if (b.ok) {
      spans.push(u8Fallback(addr, b.value))
      off += 1
      spanCount++
    } else {
      pushDiag(diags, b.error)
      break
    }
  }

  if (codeOnly && opts.codeOnlyDiag === 'aggregate' && skippedRun > 0) {
    ;(diags.skipped ??= []).push({
      start: skippedStart,
      end: u16(base + off),
      count: skippedRun,
    })
  }
  return { start: base, end: u16(base + off), spans, diags }
}

function decodeOne(
  src: ByteSource,
  offset: number,
  baseAddr = 0
): Result<DisasmNode, DisasmError> {
  const addr = u16(baseAddr + offset)
  const startOff = offset
  let consumed: number[] = []

  const readB = (): Result<number, DisasmError> => {
    const r = src.read(offset)
    if (!r.ok) return r
    const v = u8(r.value)
    consumed.push(v)
    offset += 1
    return ok(v)
  }

  const readW = (): Result<number, DisasmError> => {
    const hiR = src.read(offset)
    if (!hiR.ok) return hiR
    const loR = src.read(offset + 1)
    if (!loR.ok) return loR
    consumed.push(u8(hiR.value), u8(loR.value))
    offset += 2
    return ok(u16((hiR.value << 8) | loR.value))
  }

  const opR = readB()
  if (!opR.ok)
    return err(
      makeDisasmError({
        ...opR.error,
        message: opR.error.message || 'Unexpected end of bytes',
        addr,
        offset: startOff,
        consumed,
      })
    )

  const opcode = opR.value
  const def = OPCODE_METAS[opcode as Opcode]

  if (!def)
    return err(
      makeDisasmError({
        code: DisasmErrorCode.UnknownOpcode,
        addr,
        offset: startOff,
        message: `Unknown opcode ${fmt8(opcode)}`,
        consumed,
      })
    )

  const args: ArgNode[] = []

  for (const t of def.schema) {
    switch (t) {
      case OpType.Reg: {
        const idxR = readB()
        if (!idxR.ok) return idxR
        const idx = idxR.value
        const name = readReg(idx)
        if (!name)
          return err(
            makeDisasmError({
              code: DisasmErrorCode.BadRegister,
              addr: u16(baseAddr + (offset - 1)),
              offset: offset - 1,
              message: `Invalid register index ${idx}`,
              consumed,
            })
          )

        args.push({ kind: 'reg', name, index: idx })
        break
      }

      case OpType.Imm8: {
        const vR = readB()
        if (!vR.ok) return vR
        args.push({ kind: 'imm8', value: vR.value })
        break
      }

      case OpType.Imm16: {
        const vR = readW()
        if (!vR.ok) return vR
        args.push({ kind: 'imm16', value: vR.value })
        break
      }

      case OpType.Addr: {
        const aR = readW()
        if (!aR.ok) return aR
        args.push({ kind: 'addr', value: aR.value })
        break
      }

      default: {
        return err(
          makeDisasmError({
            code: DisasmErrorCode.BadAddressing,
            addr: u16(baseAddr + offset),
            offset,
            message: `Unsupported arg type ${String(t)}`,
            consumed,
          })
        )
      }
    }
  }

  return ok({
    addr,
    size: consumed.length,
    bytes: [...consumed],
    opcode,
    name: def.name as OpcodeName,
    args,
  })
}

function findRegionMark(
  regs: RegionHint[] | undefined,
  addr: number
): RegionHint | undefined {
  if (!regs?.length) return
  return regs.find((r) => addr >= r.start && addr < r.start + r.length)
}

function remainingInRegion(mark: RegionHint, addr: number): number {
  const len = mark.length ?? Number.POSITIVE_INFINITY
  return Math.max(0, mark.start + len - addr)
}

function readReg(byte: number) {
  return REGISTER_NAMES[byte]
}

const readByte = (src: ByteSource, off: number) => src.read(off)

function readWord(src: ByteSource, off: number): Result<number, DisasmError> {
  const hiR = src.read(off)
  if (!hiR.ok) return hiR
  const loR = src.read(off + 1)
  if (!loR.ok) return loR
  return ok(u16((hiR.value << 8) | loR.value))
}

const u8Fallback = (addr: number, v: number): Span => ({
  kind: 'u8',
  addr,
  size: 1,
  value: u8(v),
})

function pushDiag(diags: DisasmDiags, e: DisasmError) {
  diags.errors.push(e)
}

// const out = disassemble(
//   fromBytes(new Uint8Array([0xbe, 0xef, 0x10, 0x00, 0x42, 0x02, 0xff])),
//   { codeOnly: true, codeOnlyDiag: 'silent' }
// )

// console.log(JSON.stringify(out, null, 2))
