export enum VmErrorCode {
  MEM_OUT_OF_RANGE = 'MEM_OUT_OF_RANGE',
  UNMAPPED_REGION = 'UNMAPPED_REGION',
  INVALID_REG = 'INVALID_REG',
  INVALID_OPCODE = 'INVALID_OPCODE',
  DEVICE_CONFIG = 'DEVICE_CONFIG',
  DEVICE_RW = 'DEVICE_RW',
  UNKNOWN = 'UNKNOWN',
}

export class VmError extends RangeError {
  readonly code: VmErrorCode
  readonly meta?: Record<string, unknown>

  constructor(
    code: VmErrorCode,
    message: string,
    meta?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'VmError'
    this.code = code
    this.meta = meta
  }
}

export type VmResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: VmError }
