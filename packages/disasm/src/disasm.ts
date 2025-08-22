import {
  OPCODE_METAS,
  OpType,
  REGISTER_NAMES,
  type Opcode,
  type OpcodeName,
} from '@gero/vm'
import type {
  ArgNode,
  DisasmDiags,
  DisasmNode,
  DisasmOptions,
  DisasmResult,
  RegionHint,
  Span,
} from './types'
import type { ByteSource } from './source'
import { DisasmErrorCode, makeDisasmError, type DisasmError } from './errors'
import { err, ok, type Result } from './result'
import { fmt8, u16, u8 } from '@gero/util'

export function disassemble(
  src: ByteSource,
  opts: DisasmOptions = {}
): DisasmResult {
  const spans: Span[] = []
  const base = opts.baseAddr ?? 0x0000
  const limit = Math.min(src.length, opts.maxBytes ?? src.length)
  const diags: DisasmDiags = { errors: [] }
  const maxInstrs = opts.maxInstrs ?? Infinity

  let ip = 0
  let count = 0

  while (ip < limit && count < maxInstrs) {
    const addr = u16(base + ip)
    const mark = findRegionMark(opts.regions, addr)

    // Explicit marks first
    if (mark) {
      switch (mark.type) {
        case 'code': {
          const insR = decodeOne(src, ip, base)
          if (insR.ok) {
            const node = insR.value
            spans.push({
              kind: 'code',
              addr,
              bytes: node.bytes,
              size: node.size,
              node,
            })
            ip += node.size
            count++
          } else {
            pushDiag(diags, insR.error)
            if (opts.strict) {
              return { start: base, end: u16(base + ip), spans, diags }
            }

            const b = readByte(src, ip)
            if (b.ok) {
              spans.push(u8Fallback(addr, b.value))
              ip += 1
              count++
            } else {
              pushDiag(diags, b.error)
              return { start: base, end: u16(base + ip), spans, diags }
            }
          }

          continue
        }

        case 'u8': {
          const b = readByte(src, ip)
          if (!b.ok) {
            pushDiag(diags, b.error)
            return { start: base, end: u16(base + ip), spans, diags }
          }

          spans.push(u8Fallback(addr, b.value))
          ip += 1
          count++
          continue
        }

        case 'u16': {
          const w = readWord(src, ip)
          if (!w.ok) {
            pushDiag(diags, w.error)
            const b = readByte(src, ip)
            if (b.ok) {
              spans.push(u8Fallback(addr, b.value))
              ip += 1
              count++
              continue
            }

            return { start: base, end: u16(base + ip), spans, diags }
          }

          spans.push({ kind: 'u16', addr, size: 2, value: w.value })
          ip += 2
          count++
          continue
        }

        case 'table8': {
          const rem = remainingInRegion(mark, addr)
          const take = Math.min(rem, limit - ip)
          const values: number[] = []

          for (let k = 0; k < take; k++) {
            const r = readByte(src, ip + k)
            if (!r.ok) {
              pushDiag(diags, r.error)
              // cut the table at first failure
              break
            }
            values.push(u8(r.value))
          }

          spans.push({ kind: 'table8', addr, size: values.length, values })
          ip += values.length
          count++
          continue
        }

        case 'table16': {
          const rem = remainingInRegion(mark, addr)
          const raw = Math.min(rem, limit - ip)
          const even = raw & ~1
          const values: number[] = []

          for (let k = 0; k < even; k += 2) {
            const w = readWord(src, ip + k)
            if (!w.ok) {
              pushDiag(diags, w.error)
              break
            }
            values.push(w.value)
          }

          spans.push({ kind: 'table16', addr, size: values.length * 2, values })
          ip += values.length * 2
          count++
          continue
        }
      }
    }

    // no explicit mark -> try to decode code
    const insR = decodeOne(src, ip, base)
    if (insR.ok) {
      const node = insR.value
      spans.push({
        kind: 'code',
        addr,
        bytes: node.bytes,
        size: node.size,
        node,
      })
      ip += node.size
      count++
      continue
    }

    // decode failed -> record and recover (or stop in strict)
    pushDiag(diags, insR.error)
    if (opts.strict) {
      return { start: base, end: u16(base + ip), spans, diags }
    }

    const b = readByte(src, ip)
    if (b.ok) {
      spans.push(u8Fallback(addr, b.value))
      ip += 1
      count++
    } else {
      pushDiag(diags, b.error)
      break
    }
  }

  return { start: base, end: u16(base + ip), spans, diags }
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
