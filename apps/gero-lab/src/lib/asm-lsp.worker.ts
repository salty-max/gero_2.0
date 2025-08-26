/// <reference lib="webworker" />
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/browser'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as F from '@gero/asm-lsp'

declare global {
  var __GERO__ASM_LSP_WORKER_INITIALIZED__: boolean | undefined
}

if (!globalThis.__GERO__ASM_LSP_WORKER_INITIALIZED__) {
  globalThis.__GERO__ASM_LSP_WORKER_INITIALIZED__ = true

  const worker = self as unknown as DedicatedWorkerGlobalScope
  const connection = createConnection(
    new BrowserMessageReader(worker),
    new BrowserMessageWriter(worker)
  )
  const documents = new TextDocuments(TextDocument)
  const states = new Map<string, F.DocState>()

  connection.onInitialize(() => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['.', '%'],
      },
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      semanticTokensProvider: {
        legend: F.SEMANTIC_LEGEND,
        range: true,
        full: true,
      },
    },
  }))

  // Build immediately on open
  documents.onDidOpen(({ document }) => {
    const s = F.buildState(document.uri, document.getText())
    states.set(document.uri, s)
    connection.sendDiagnostics({ uri: document.uri, diagnostics: s.diags })
  })

  // Debounced rebuild on change
  let changeTimer: number | undefined
  documents.onDidChangeContent(({ document }) => {
    if (changeTimer) clearTimeout(changeTimer)
    changeTimer = setTimeout(() => {
      const s = F.buildState(document.uri, document.getText())
      states.set(document.uri, s)
      connection.sendDiagnostics({ uri: document.uri, diagnostics: s.diags })
    }, 100) as unknown as number
  })

  // Cleanup on close
  documents.onDidClose(({ document }) => {
    states.delete(document.uri)
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] })
  })

  // Helper: ensure we always have a state (even if a request races before open/change)
  function ensureState(uri: string): F.DocState | null {
    const s = states.get(uri)
    if (s) return s
    const doc = documents.get(uri)
    if (!doc) return null
    const built = F.buildState(uri, doc.getText())
    states.set(uri, built)
    return built
  }

  connection.onCompletion(({ textDocument }) => {
    const s = ensureState(textDocument.uri)
    return s ? F.completions(s) : null
  })

  connection.onHover(({ textDocument, position }) => {
    const s = ensureState(textDocument.uri)
    return s ? F.hover(s, position) : null
  })

  connection.onDefinition(({ textDocument, position }) => {
    const s = ensureState(textDocument.uri)
    return s ? F.definition(s, position) : null
  })

  connection.onDocumentSymbol(({ textDocument }) => {
    const s = ensureState(textDocument.uri)
    return s ? F.documentSymbols(s) : []
  })

  connection.languages.semanticTokens.on((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return { data: [] }

    return F.semanticTokensFull({
      uri: doc.uri,
      text: doc.getText(),
      labels: states.get(doc.uri)?.labels ?? new Map(),
      diags: states.get(doc.uri)?.diags ?? [],
      bytes: states.get(doc.uri)?.bytes ?? new Uint8Array([]),
    })
  })

  connection.languages.semanticTokens.onRange((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return { data: [] }
    const state = states.get(doc.uri) ?? F.buildState(doc.uri, doc.getText())
    return F.semanticTokensRange(
      { ...state, text: doc.getText() },
      params.range
    )
  })

  documents.listen(connection)
  connection.listen()
}
