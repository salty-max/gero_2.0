export enum DisasmErrorCode {
  UnknownOpcode = 'UnknownOpcode',
  Truncated = 'Truncated',
  BadRegister = 'BadRegister',
  BadAddressing = 'BadAddressing',
  OutOfBounds = 'OutOfBounds',
  InvalidByte = 'InvalidByte',
}

export type DisasmError = {
  name: 'DisasmError'
  code: DisasmErrorCode
  addr: number
  offset: number
  consumed?: number[]
  ctx?: Record<string, unknown>
  message: string
}

export const makeDisasmError = (
  args: Omit<DisasmError, 'name'>
): DisasmError => ({ name: 'DisasmError', ...args })

export const isDisasmError = (x: unknown): x is DisasmError =>
  !!x && typeof x === 'object' && (x as DisasmError).name === 'DisasmError'
