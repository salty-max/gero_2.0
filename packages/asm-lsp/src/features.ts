import type { DefIndex, SourceEntry } from '@gero/asm/assemble'
import type {
  ArgNode,
  InstructionNode,
  ProgramNode,
} from '@gero/asm/parser/types'
import { fmt8, fmt16 } from '@gero/util'
import {
  type CompletionItem,
  CompletionItemKind,
  type CompletionList,
  type Diagnostic,
  Hover,
  Location,
  type Position,
  type Range,
  type SemanticTokens,
  type SemanticTokensLegend,
  SymbolInformation,
} from 'vscode-languageserver-types'

import {
  ISA,
  type LabelDef,
  runAssemble,
  runParse,
  type Tok,
} from './asm-adapter'

type AsmLoc = { line?: number; column?: number; offset?: number }

export type DocState = {
  uri: string
  text: string
  labels: Map<string, LabelDef>
  diags: Diagnostic[]
  bytes?: Uint8Array
  sourceMap?: SourceEntry[]
  defs?: DefIndex
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
    range: toLspRangeFromAsm(d.location, text),
    code: d.code ?? undefined,
    message: d.message,
    source: 'asm-lsp',
  }))
  return {
    uri,
    text,
    labels,
    diags,
    bytes: asm.bytes,
    sourceMap: asm.sourceMap,
    defs: asm.defs,
  }
}

export function completions(state: DocState): CompletionList {
  const mnemonicItems: CompletionItem[] = [...new Set(ISA.mnemonics)].map(
    (m) => ({
      label: m,
      kind: CompletionItemKind.Keyword,
    })
  )

  const registerItems: CompletionItem[] = [...new Set(ISA.registers)].map(
    (r) => ({
      label: r,
      kind: CompletionItemKind.Variable,
    })
  )

  const labelItems: CompletionItem[] = [...new Set(state.labels.keys())].map(
    (s) => ({
      label: s,
      kind: CompletionItemKind.Function,
    })
  )

  return {
    isIncomplete: false,
    items: [...mnemonicItems, ...registerItems, ...labelItems],
  }
}

export function hover(state: DocState, pos: Position): Hover | null {
  const parsed = runParse(state.text)
  const ast = parsed.ast ?? []
  const lineStarts = buildLineStarts(state.text)
  const idx = indexFromPos(lineStarts, pos.line, pos.character)

  const ins = instructionAt(ast, idx)
  if (!ins) return null

  const renderedArgs = ins.args.map((a) => renderArg(a, state.text)).join(', ')
  let bytesMd = '**bytes:** _(unavailable)_'

  if (state.bytes && state.sourceMap) {
    const entry = state.sourceMap.find(
      (e) => e.kind === 'instruction' && idx >= e.loc.start && idx < e.loc.end
    ) as Extract<SourceEntry, { kind: 'instruction' }> | undefined

    if (entry) {
      const slice = (state.bytes as Uint8Array).slice(
        entry.addr,
        entry.addr + entry.size
      )
      const hex = [...slice].map((b) => fmt8(b)).join(' ')
      bytesMd = `**bytes:** \`${hex}\``
    }
  }

  const md = `**${ins.opcode}** ${renderedArgs}\n\n${bytesMd}`
  return { contents: { kind: 'markdown', value: md } }
}

export function definition(state: DocState, pos: Position): Location | null {
  const line = getLine(state.text, pos.line)
  const { word } = wordAt(line, pos.character)
  if (!word) return null

  const d = state.defs?.[word]
  if (d) {
    return {
      uri: state.uri,
      range: {
        start: {
          line: toZero(d.loc.start, state.text).line,
          character: toZero(d.loc.start, state.text).char,
        },
        end: {
          line: toZero(d.loc.end, state.text).line,
          character: toZero(d.loc.end, state.text).char,
        },
      },
    }
  }

  return null
}

export function documentSymbols(state: DocState): SymbolInformation[] {
  return [...state.labels.values()].map((l) => ({
    name: l.name,
    kind: 12,
    location: { uri: state.uri, range: toRange(l.line, l.col) },
  }))
}

/* ---------------- semantic tokens ---------------- */

/** Legend the client & server must agree on. */
export const SEMANTIC_LEGEND: SemanticTokensLegend = {
  tokenTypes: [
    'keyword', // 0 mnemonic, directive
    'variable', // 1 registers, idents
    'number', // 2 hex literals, addr literals
    'operator', // 3 + - *
    'type', // 4 labels (so they pop nicely)
    'macro', // 5 +export
  ],
  tokenModifiers: [],
}

/** Full document semantic tokens from current state.text. */
export function semanticTokensFull(state: DocState): SemanticTokens {
  const parsed = runParse(state.text)
  const tokens = parsed.tokens
  const lineStarts = buildLineStarts(state.text)
  return buildSemantic(tokens, lineStarts)
}

/** Range semantic tokens (filtering to an LSP Range). */
export function semanticTokensRange(
  state: DocState,
  range: Range
): SemanticTokens {
  const parsed = runParse(state.text)
  const tokens = parsed.tokens
  const lineStarts = buildLineStarts(state.text)
  const startIdx = indexFromPos(
    lineStarts,
    range.start.line,
    range.start.character
  )
  const endIdx = indexFromPos(lineStarts, range.end.line, range.end.character)
  const sliced = tokens.filter((t) => t.to > startIdx && t.from < endIdx)
  return buildSemantic(sliced, lineStarts)
}

/* ---------------- helpers ---------------- */

function buildSemantic(tokens: Tok[], lineStarts: number[]): SemanticTokens {
  // Sort by source order (delta encoding needs it)
  const sorted = [...tokens].sort((a, b) => a.from - b.from)
  const data: number[] = []
  let prevLine = 0
  let prevChar = 0

  for (const t of sorted) {
    const { line, char } = indexToPos(lineStarts, t.from)
    const len = Math.max(0, t.to - t.from)
    const deltaLine = data.length === 0 ? line : line - prevLine
    const deltaStart = deltaLine === 0 ? char - prevChar : char
    const tokenType = mapTokType(t.type)
    const tokenMods = 0

    data.push(deltaLine, deltaStart, len, tokenType, tokenMods)
    prevLine = line
    prevChar = char
  }
  return { data }
}

/** Map your Tok.type to our legend indexes. */
function mapTokType(tt: string): number {
  switch (tt) {
    case 'mnemonic':
    case 'directive':
      return 0 // keyword
    case 'register':
    case 'register-ptr':
    case 'ident':
      return 1 // variable
    case 'number-hex':
    case 'addr-literal':
      return 2 // number
    case 'op-plus':
    case 'op-minus':
    case 'op-mul':
      return 3 // operator
    case 'label':
    case 'cast':
      return 4 // type
    case 'kw-export':
      return 5 // macro
    default:
      return 1 // default to 'variable'
  }
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

function toLspRangeFromAsm(loc: AsmLoc | undefined, text: string) {
  if (loc?.line !== null && loc?.column !== null) {
    return toRange(loc?.line, loc?.column)
  }

  if (loc.offset !== null) {
    const starts = buildLineStarts(text)
    const { line, char } = indexToPos(starts, loc.offset!)
    return {
      start: { line, character: char },
      end: { line, character: char + 1 },
    }
  }

  return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
}

function isWordChar(ch: number) {
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
  let i = Math.max(0, Math.min(col, line.length)),
    s = i,
    e = i
  while (s > 0 && isWordChar(line.charCodeAt(s - 1))) s--
  while (e < line.length && isWordChar(line.charCodeAt(e))) e++
  return { from: s, to: e, word: line.slice(s, e) }
}

/* index/pos utils for semantic delta encoding */
function buildLineStarts(src: string): number[] {
  const a = [0]
  for (let i = 0; i < src.length; i++)
    if (src.charCodeAt(i) === 10) a.push(i + 1)
  return a
}

function indexToPos(starts: number[], idx: number) {
  if (starts.length === 0) return { line: 0, char: Math.max(0, idx) }
  let lo = 0,
    hi = starts.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const midVal = starts[mid]!
    if (midVal <= idx) lo = mid + 1
    else hi = mid - 1
  }
  let line = Math.max(0, Math.min(hi, starts.length - 1))
  const lineStart = starts[line] ?? 0
  const char = Math.max(0, idx - lineStart)
  return { line, char }
}

function indexFromPos(starts: number[], line: number, char: number) {
  const base = starts[Math.max(0, Math.min(line, starts.length - 1))] ?? 0
  return base + Math.max(0, char)
}

function instructionAt(
  ast: ProgramNode[],
  index: number
): InstructionNode | null {
  for (const n of ast)
    if (n.type === 'INSTRUCTION' && index >= n.loc.start && index < n.loc.end)
      return n
  return null
}

function renderArg(arg: ArgNode, src: string): string {
  switch (arg.type) {
    case 'REGISTER':
      return arg.value
    case 'REGISTER_PTR':
      return `&${arg.value}`
    case 'HEX_LITERAL':
      return fmt16(arg.value)
    case 'ADDR_LITERAL':
      return fmt16(arg.value)
    case 'ADDRESS': {
      const e = arg.expr
      if (e.type === 'HEX_LITERAL' || e.type === 'ADDR_LITERAL')
        return `&${fmt16(e.value)}`
      if (e.type === 'VARIABLE') return `&${e.value}`
      return src.slice(arg.loc.start, arg.loc.end).trim()
    }
    default:
      return src.slice(arg.loc.start, arg.loc.end).trim()
  }
}

/* Convert absolute index to LSP pos (0-based) */
function toZero(idx: number, src: string): { line: number; char: number } {
  const starts = buildLineStarts(src)
  return indexToPos(starts, idx)
}
