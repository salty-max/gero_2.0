import { fmt16, u16, u8 } from '@gero/util'
import { type MemoryMapper } from '@gero/vm'
import { DisasmErrorCode, makeDisasmError, type DisasmError } from './errors'
import { err, ok, type Result } from './result'

export type ByteSource = {
  read: (offset: number) => Result<number, DisasmError>
  length: number
}

export function fromBytes(buf: ArrayLike<number>): ByteSource {
  const len = buf.length ?? 0
  return {
    length: len,
    read: (offset) => {
      if (offset < 0 || offset >= len)
        return err(
          makeDisasmError({
            code: DisasmErrorCode.OutOfBounds,
            addr: u16(offset),
            offset,
            message: `Read out of bounds at offset ${fmt16(offset)}`,
            ctx: { length: len },
          })
        )
      const v = buf[offset]

      if (typeof v !== 'number' || Number.isNaN(v))
        return err(
          makeDisasmError({
            code: DisasmErrorCode.InvalidByte,
            addr: u16(offset),
            offset,
            message: `Invalid byte at offset ${offset}`,
          })
        )

      return ok(u8(v))
    },
  }
}

export function fromMemoryMapper(
  mm: MemoryMapper,
  start: number,
  size: number
): ByteSource {
  return {
    length: size,
    read: (off: number) => ok(mm.getUint8(u16(start + off))),
  }
}
