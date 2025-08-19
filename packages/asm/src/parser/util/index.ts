import * as P from 'parsil'

export function last<T>(a: T[]): T {
  return a[a.length - 1]!
}

export const peekChar = (run: <K>(p: P.Parser<K>) => K) =>
  String.fromCharCode(run(P.peek))

export const isOpChar = (c: string) => c === '+' || c === '-' || c === '*'
