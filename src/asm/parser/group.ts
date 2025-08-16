import * as P from 'parsil'
import {
  asBinaryOp,
  asSquareBracketExpr,
  isOperator,
  typeParenExpr,
  type ExprToken,
  type GroupNode,
  type Nested,
  type OperandNode,
  type OperatorNode,
  type ParenExprNode,
} from './types'
import { hexLiteral, operator, variable } from './common'
import { isOpChar, last, peekChar } from './util'

const PRIORITIES: Record<OperatorNode['type'], number> = {
  FACTOR: 2,
  PLUS: 1,
  MINUS: 0,
}

const at = <T>(arr: T[], idx: number, msg: string): T => {
  const v = arr[idx]
  if (v === undefined) throw new Error(msg)
  return v
}

function readValue(tok: ExprToken): OperandNode {
  if (isOperator(tok)) throw new Error('Expected value, got operator')
  if (tok.type === 'PAREN_EXPR' || tok.type === 'SQUARE_BRACKET_EXPR') {
    const { node, next } = parseExpr(tok.expr, 0, 0)
    if (next !== tok.expr.length) throw new Error('Trailing tokens in group')
    return node
  }
  return tok
}

export function parseExpr(
  tokens: ExprToken[],
  i = 0,
  minPrec = 0
): { node: OperandNode; next: number } {
  if (tokens.length === 0) throw new Error('Empty expression')

  let idx = i

  // LHS: must start with a value
  const first = at(tokens, idx++, 'Expected value at start of expression')
  let lhs = readValue(first)

  // (op rhs)*
  while (idx < tokens.length) {
    const opTok = tokens[idx]
    if (!isOperator(opTok!)) break

    const prec = PRIORITIES[opTok.type]
    if (prec < minPrec) break

    // consume operator
    const op = opTok
    idx++

    // parse the entire RHS with tighter binding
    const rhsParsed = parseExpr(tokens, idx, prec + 1)
    const rhs = rhsParsed.node
    idx = rhsParsed.next

    lhs = asBinaryOp(lhs, rhs, op)
  }

  return { node: lhs, next: idx }
}
function foldGroup<G extends GroupNode>(group: G): G {
  if (group.expr.length === 0) throw new Error('Empty group')
  if (group.expr.length === 1 && !isOperator(group.expr[0]!)) return group

  const { node, next } = parseExpr(group.expr, 0, 0)
  if (next !== group.expr.length) {
    throw new Error('Unexpected trailing tokens in expression')
  }

  return { ...group, expr: [node] } as G
}

const eatSpaces = (run: any): number => {
  let n = 0
  while (peekChar(run) === ' ') {
    run(P.char(' '))
    n++
  }
  return n
}

export const squareBracketExpr = P.coroutine((run) => {
  run(P.char('['))

  run(P.optionalWhitespace)

  enum S {
    EXPECT_VAL,
    EXPECT_OP,
  }
  let state = S.EXPECT_VAL
  const expr: ExprToken[] = []

  while (true) {
    if (state === S.EXPECT_VAL) {
      const ch = peekChar(run)

      if (ch === ']') {
        if (expr.length === 0) run(P.fail('Empty group'))
        run(P.fail('Expected right-hand value after operator'))
      }
      if (isOpChar(ch)) run(P.fail('Expected value, got operator'))

      const val = run(P.choice([hexLiteral, variable, parenExpr]))
      expr.push(val)
      state = S.EXPECT_OP
      continue
    }

    const nSpacesBefore = eatSpaces(run)

    if (peekChar(run) === ']') {
      run(P.char(']'))
      break
    }

    if (nSpacesBefore > 1)
      run(P.fail('Only a single space allowed before operator'))
    if (!isOpChar(peekChar(run))) run(P.fail('Expected operator or "]"'))

    expr.push(run(operator))
    state = S.EXPECT_VAL

    const nSpacesAfterOp = eatSpaces(run)
    if (nSpacesAfterOp > 1)
      run(P.fail('Only a single space allowed before value'))
  }

  return asSquareBracketExpr(expr)
}).map(foldGroup)

const parenExpr: P.Parser<ParenExprNode> = P.coroutine<ParenExprNode>((run) => {
  enum States {
    OPEN_BRACKET,
    OP_OR_CLOSE,
    ELEMENT_OR_OPEN,
    CLOSE_BRACKET,
  }

  const expr: Nested<ExprToken> = []
  const stack: Nested<ExprToken>[] = [expr]
  const open = P.char('(')
  const close = P.char(')')

  run(open)
  run(P.optionalWhitespace)

  let state = States.ELEMENT_OR_OPEN

  while (true) {
    const curr = last(stack)
    const nextChar = peekChar(run)

    switch (state) {
      case States.OPEN_BRACKET: {
        run(open)
        const child: Nested<ExprToken> = []
        curr.push(child)
        stack.push(child)
        run(P.optionalWhitespace)
        state = States.ELEMENT_OR_OPEN
        break
      }

      case States.CLOSE_BRACKET: {
        run(close)
        stack.pop()
        if (stack.length === 0) {
          return typeParenExpr(expr)
        }
        state = States.OP_OR_CLOSE
        break
      }

      case States.ELEMENT_OR_OPEN: {
        if (nextChar === ')') {
          if (curr.length === 0) run(P.fail('Empty group'))
          run(P.fail('Expected right-hand value after operator'))
        }
        if (nextChar === '(') {
          state = States.OPEN_BRACKET
        } else {
          if (isOpChar(nextChar)) run(P.fail('Expected value, got operator'))

          curr.push(run(P.choice<ExprToken>([hexLiteral, variable])))
          state = States.OP_OR_CLOSE
        }
        break
      }

      case States.OP_OR_CLOSE: {
        const nSpaces = eatSpaces(run)
        if (peekChar(run) === ')') {
          state = States.CLOSE_BRACKET
          break
        }

        if (nSpaces > 1)
          run(P.fail('Only a single space allowed before operator'))
        if (!isOpChar(peekChar(run))) run(P.fail('Expected operator or ")"'))

        curr.push(run(operator))

        const nAfter = eatSpaces(run)
        if (nAfter > 1) run(P.fail('Only a single space allowed before value'))

        state = States.ELEMENT_OR_OPEN
        break
      }
    }
  }
}).map(foldGroup)
