/// <reference lib="webworker" />
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/browser'
import { TextDocument } from 'vscode-languageserver-textdocument'

import * as F from './features'

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
  },
}))

documents.onDidChangeContent(({ document }) => {
  const s = F.buildState(document.uri, document.getText())
  states.set(document.uri, s)
  connection.sendDiagnostics({ uri: document.uri, diagnostics: s.diags })
})

connection.onCompletion(({ textDocument }) =>
  states.get(textDocument.uri)
    ? F.completions(states.get(textDocument.uri)!)
    : null
)
connection.onHover(({ textDocument, position }) =>
  states.get(textDocument.uri)
    ? F.hover(states.get(textDocument.uri)!, position)
    : null
)
connection.onDefinition(({ textDocument, position }) =>
  states.get(textDocument.uri)
    ? F.definition(states.get(textDocument.uri)!, position)
    : null
)
connection.onDocumentSymbol(({ textDocument }) =>
  states.get(textDocument.uri)
    ? F.documentSymbols(states.get(textDocument.uri)!)
    : []
)

documents.listen(connection)
connection.listen()
