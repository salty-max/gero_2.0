import { parseOrReport } from '@gero/asm/parser/errors'
import type { AsmParser } from '@gero/asm/parser/types'

export function runOk<T>(p: AsmParser<T>, input: string): T {
  const r = parseOrReport(p, input)
  if (r.ok) return r.result
  throw new Error(r.message)
}

export function runFail<T>(p: AsmParser<T>, input: string): string {
  const r = parseOrReport(p, input)
  if (r.ok)
    throw new Error(
      `Expected failure, but succeeded:\n${JSON.stringify(r.result, null, 2)}`
    )
  return r.message
}
