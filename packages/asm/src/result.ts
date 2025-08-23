import { assemble as assembleCore, type AssembleResult } from './assemble'
import { AssembleError } from './errors'
import parser from './parser'
import { parseOrReport } from './parser/errors'

export type AssembleReturn =
  | { ok: true; result: AssembleResult }
  | { ok: false; error: AssembleError }

/**
 * Assemble and return a Result-like object instead of throwing or exiting.
 * This wraps all failures into an AssembleError without exposing internal parser types.
 */
export function assembleResult(source: string): AssembleReturn {
  // First, try to parse and capture parse errors
  const parsed = parseOrReport(parser, source)
  if (!parsed.ok) {
    return { ok: false, error: new AssembleError('PARSE', parsed.message) }
  }

  // Reuse the core assemble with throw mode, but convert thrown errors to result
  try {
    const result = assembleCore(source, { onError: 'throw' })
    return { ok: true, result }
  } catch (e) {
    if (e && typeof e === 'object' && (e as any).name === 'AssembleError') {
      return { ok: false, error: e as AssembleError }
    }
    // Fallback: coerce to AssembleError with a generic code
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: new AssembleError('PARSE', msg) }
  }
}
