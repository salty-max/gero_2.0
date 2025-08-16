import type { RegIndex } from './instructions'

export const REGISTER_NAMES = [
  'ip',
  'acc',
  'r1',
  'r2',
  'r3',
  'r4',
  'r5',
  'r6',
  'r7',
  'r8',
  'sp',
  'fp',
] as const

export type RegName = (typeof REGISTER_NAMES)[number]

export function regIndex(name: RegName): RegIndex {
  return REGISTER_NAMES.indexOf(name) as RegIndex
}
