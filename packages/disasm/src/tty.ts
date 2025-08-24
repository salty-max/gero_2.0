// TTY formatter stub (to be implemented)
import type { DisasmNode } from './types'

export type TtyFormatOptions = {
  useColor?: boolean
  addrBase?: 16 | 10
}

export function formatTty(
  _nodes: DisasmNode[],
  _opts: TtyFormatOptions = {}
): string {
  throw new Error('Not implemented: formatTty')
}
