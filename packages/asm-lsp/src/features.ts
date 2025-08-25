import { fmt8 } from '@gero/util'
import {
  type CompletionItem,
  CompletionItemKind,
  type CompletionList,
  type Diagnostic,
  Hover,
  Location,
  type Position,
  type Range,
  SymbolInformation,
} from 'vscode-languageserver-types'

import { ISA, type LabelDef, runAssemble, runParse } from './asm-adapter'

export type DocState = {
  uri: string
  text: string
  // keep last parse/build so completions/defs can use symbol tables
  labels: Map<string, LabelDef>
  diags: Diagnostic[]
  bytes?: Uint8Array
}

export function buildState(uri: string, text: string): DocState {
  const p = runParse(text)
  const asm = runAssemble(text)
  const symNames = new Set(Object.keys(asm.symbols))
  const merged = p.labels.filter(
    (l) => symNames.size === 0 || symNames.has(l.name)
  )
  const labels = new Map<string, LabelDef>(merged.map((l) => [l.name, l]))
  const diags: Diagnostic[] = (asm.diagnostics ?? []).map((d) => ({
    severity: 1,
    range: toRange(d.location?.line, d.location?.column),
    code: d.code ?? undefined,
    message: d.message,
    source: 'asm-lsp',
  }))

  return { uri, text, labels, diags, bytes: asm.bytes }
}

export function completions(state: DocState): CompletionList {
  const items: CompletionItem[] = [
    ...ISA.mnemonics.map((m) => ({
      label: m,
      kind: CompletionItemKind.Keyword,
    })), // Keyword
    ...ISA.registers.map((r) => ({
      label: r,
      kind: CompletionItemKind.Variable,
    })), // Variable
    ...[...state.labels.keys()].map((s) => ({
      label: s,
      kind: CompletionItemKind.Function,
    })),
  ]
  return { isIncomplete: false, items }
}

export function hover(state: DocState, pos: Position): Hover | null {
  const lineText = getLine(state.text, pos.line)
  const trimmed = lineText.trim()
  if (!trimmed || trimmed.startsWith(';')) return null

  const r = runAssemble(lineText + '\n')
  if (r.hasErrors || r.bytes.length === 0) return null

  const hex = [...r.bytes].map((b) => fmt8(b)).join(' ')
  return { contents: { kind: 'markdown', value: `**bytes:** \`${hex}\`` } }
}

export function definition(state: DocState, pos: Position): Location | null {
  const line = getLine(state.text, pos.line)
  const { word } = wordAt(line, pos.character)
  if (!word) return null
  const def = state.labels.get(word)
  if (!def) return null
  return { uri: state.uri, range: toRange(def.line, def.col) }
}

export function documentSymbols(state: DocState): SymbolInformation[] {
  return [...state.labels.values()].map((l) => ({
    name: l.name,
    kind: 12,
    location: { uri: state.uri, range: toRange(l.line, l.col) },
  }))
}

function getLine(text: string, line: number): string {
  const lines = text.split(/\r?\n/)
  return lines[line] ?? ''
}

function toRange(line?: number, column?: number): Range {
  const l = Math.max(0, (line ?? 1) - 1)
  const c = Math.max(0, (column ?? 1) - 1)
  return {
    start: { line: l, character: c },
    end: { line: l, character: c + 1 },
  }
}

function isWordChar(ch: number) {
  // a-z A-Z 0-9 _ % .
  return (
    (ch >= 48 && ch <= 57) ||
    (ch >= 65 && ch <= 90) ||
    (ch >= 97 && ch <= 122) ||
    ch === 95 ||
    ch === 37 ||
    ch === 46
  )
}

function wordAt(
  line: string,
  col: number
): { from: number; to: number; word: string } {
  let i = Math.max(0, Math.min(col, line.length))
  let s = i,
    e = i
  while (s > 0 && isWordChar(line.charCodeAt(s - 1))) s--
  while (e < line.length && isWordChar(line.charCodeAt(e))) e++
  return { from: s, to: e, word: line.slice(s, e) }
}
