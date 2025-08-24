export type AssembleErrorCode =
  | 'PARSE'
  | 'LABEL_EXISTS'
  | 'CONST_EXISTS'
  | 'STRUCT_EXISTS'
  | 'TABLE_EXISTS'
  | 'UNRESOLVED_LABEL'
  | 'UNRESOLVED_STRUCT'
  | 'UNRESOLVED_PROPERTY'
  | 'UNRESOLVED_SYMBOL'
  | 'UNSUPPORTED_NODE'

export class AssembleError extends Error {
  readonly code: AssembleErrorCode
  constructor(code: AssembleErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AssembleError'
  }
}
