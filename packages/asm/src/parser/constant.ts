import * as P from 'parsil'

import {
  exportMarker,
  hexLiteralCore,
  HSPACE,
  O_HSPACE,
  operatorCore,
  validIdentifier,
} from './common'
import { AsmErrors, toAsm } from './errors'
import { parseExpr, squareBracketCore } from './group'
import {
  asConstant,
  type AsmParser,
  type ConstantNode,
  type ExprToken,
} from './types'

export const constant: AsmParser<ConstantNode> = toAsm(
  P.coroutine((run) => {
    const isExport = Boolean(run(exportMarker))

    run(P.str('const'))
    run(HSPACE)

    try {
      run(validIdentifier.lookahead())
    } catch {
      run(P.fail('Invalid identifier'))
    }
    const name = run(validIdentifier)

    run(P.between(O_HSPACE, O_HSPACE)(P.char('=')))

    // Parse a simple expression made of hex literals, [bracketed expr] and + - *
    // Build tokens, then fold with parseExpr to a single ExprNode
    const tokens: ExprToken[] = []

    // Ensure we have a starting value
    try {
      run(P.choice([P.char('$'), P.char('[')]).lookahead())
    } catch {
      // Keep legacy message for tests while still allowing bracketed expressions
      run(P.fail('Expected hex literal or [ ... ] expression'))
    }
    // Parse first value with char-based dispatch to preserve specific errors
    const parseValue = () =>
      P.coroutine((run2: <T>(p: P.Parser<T>) => T) => {
        const peek = run2(P.peek)
        if (peek === -1)
          run2(P.fail('Expected hex literal or [ ... ] expression'))
        const ch = String.fromCharCode(peek)
        if (ch === '$') return run2(hexLiteralCore)
        if (ch === '[') return run2(squareBracketCore)
        run2(P.fail('Expected hex literal or [ ... ] expression'))
      })

    // First value
    const firstVal = run(parseValue())
    if (typeof firstVal === 'undefined')
      run(P.fail('Expected hex literal or [ ... ] expression'))
    tokens.push(firstVal as ExprToken)

    // Zero or more (op value)
    while (true) {
      // Optional spaces
      run(O_HSPACE)
      const next = run(P.possibly(operatorCore))
      if (!next) break
      tokens.push(next)
      run(O_HSPACE)

      const val = run(parseValue())
      if (typeof val === 'undefined')
        run(P.fail('Expected hex literal or [ ... ] expression'))
      tokens.push(val as ExprToken)
    }

    // Fold expression tokens
    const { node } = parseExpr(tokens, 0, 0)
    const value = node

    run(O_HSPACE)

    return { name, isExport, value }
  })
    .withSpan()
    .map(({ value, start, end }) =>
      asConstant({ ...value, loc: { start, end } })
    ),
  AsmErrors.E_CONST
)
