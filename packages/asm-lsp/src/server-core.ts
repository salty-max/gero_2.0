import {
  type _Connection,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import * as F from './features'

export function wireServer(connection: _Connection) {
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
      // Provide semantic tokens so editors (e.g., Zed) can color via LSP only
      semanticTokensProvider: {
        legend: F.SEMANTIC_LEGEND,
        full: true,
        range: true,
      },
    },
  }))

  documents.onDidOpen(({ document }) => {
    const s = F.buildState(document.uri, document.getText())
    states.set(document.uri, s)
    connection.sendDiagnostics({ uri: document.uri, diagnostics: s.diags })
  })

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

  // Semantic tokens (full document)
  connection.languages.semanticTokens.on(({ textDocument }) => {
    const s = states.get(textDocument.uri)
    return s ? F.semanticTokensFull(s) : { data: [] }
  })

  // Semantic tokens (range)
  connection.languages.semanticTokens.onRange(({ textDocument, range }) => {
    const s = states.get(textDocument.uri)
    return s ? F.semanticTokensRange(s, range) : { data: [] }
  })

  documents.listen(connection)
}
