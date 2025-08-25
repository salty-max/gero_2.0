export enum AssembleErrorCode {
  Parse = 'Parse',
  LabelExists = 'LabelExists',
  ConstExists = 'ConstExists',
  StructExists = 'StructExists',
  TableExists = 'TableExists',
  UnresolvedLabel = 'UnresolvedLabel',
  UnresolvedStruct = 'UnresolvedStruct',
  UnresolvedProperty = 'UnresolvedProperty',
  UnresolvedSymbol = 'UnresolvedSymbol',
  UnsupportedNode = 'UnsupportedNode',
}

export type AssembleError = {
  name: 'AssembleError'
  code: AssembleErrorCode
  message: string
  location?: {
    line?: number
    column?: number
    offset?: number
  }
  ctx?: Record<string, unknown>
}

export const makeAssembleError = (
  args: Omit<AssembleError, 'name'>
): AssembleError => ({ name: 'AssembleError', ...args })

export const isAssembleError = (x: unknown): x is AssembleError =>
  !!x && typeof x === 'object' && (x as AssembleError).name === 'AssembleError'
