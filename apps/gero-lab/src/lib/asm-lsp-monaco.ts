import * as monaco from 'monaco-editor'
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createMessageConnection,
} from 'vscode-jsonrpc/browser'
import type { MessageConnection } from 'vscode-jsonrpc'
import {
  type InitializeResult,
  type PublishDiagnosticsParams,
  type Hover,
  type CompletionList,
  type Definition,
  type Location,
  type LocationLink,
  type Range as LspRange,
  CompletionItemKind as LspCompletionItemKind,
} from 'vscode-languageserver-protocol'

export type AsmMonacoLspHandle = {
  dispose(): void
  connection: MessageConnection
}

// Shared worker/connection (singleton-style) to mirror VM worker pattern
let sharedWorker: Worker | null = null
let sharedConnection: MessageConnection | null = null
let connectionListening = false
let attachRefCount = 0
let lspInitialized = false
let lspInitPromise: Promise<void> | null = null

// Map of URI -> diagnostics applier. One global listener dispatches to these.
const diagHandlers = new Map<
  string,
  (params: PublishDiagnosticsParams) => void
>()

function getSharedConnection(workerCtor: {
  new (): Worker
}): MessageConnection {
  if (!sharedWorker) {
    sharedWorker = new workerCtor()
  }
  if (!sharedConnection) {
    const reader = new BrowserMessageReader(sharedWorker)
    const writer = new BrowserMessageWriter(sharedWorker)
    sharedConnection = createMessageConnection(reader, writer)
  }
  if (!connectionListening) {
    connectionListening = true
    sharedConnection.listen()
    // Install one global diagnostics listener and dispatch to per-URI handlers
    sharedConnection.onNotification(
      'textDocument/publishDiagnostics',
      (params: PublishDiagnosticsParams) => {
        const uri = params.uri
        const fn = diagHandlers.get(uri)
        fn?.(params)
      }
    )
  }
  attachRefCount += 1
  return sharedConnection
}

function releaseSharedConnection() {
  attachRefCount = Math.max(0, attachRefCount - 1)
  if (attachRefCount === 0) {
    try {
      sharedConnection?.end()
    } catch {
      // ignore
    }
    try {
      sharedConnection?.dispose()
    } catch {
      // ignore
    }
    try {
      sharedWorker?.terminate()
    } catch {
      // ignore
    }
    sharedConnection = null
    sharedWorker = null
    connectionListening = false
    diagHandlers.clear()
  }
}

/**
 * Register the language id once (safe to call multiple times).
 */
export function ensureAsmLanguageRegistered(id = 'gero-asm') {
  // Monaco doesn't expose an isRegistered flag; re-registering is harmless.
  monaco.languages.register({ id })
}

/**
 * Returns a disposable handle that unregisters providers, closes the connection,
 * terminates the worker, and clears markers.
 */
export function attachAsmLspToModel(options: {
  model: monaco.editor.ITextModel
  workerCtor: { new (): Worker }
  languageId?: string
}): AsmMonacoLspHandle {
  const { model, workerCtor, languageId = 'gero-asm' } = options
  ensureAsmLanguageRegistered(languageId)

  const uri = model.uri
  const connection = getSharedConnection(workerCtor)

  let disposed = false

  function hasMessage(e: unknown): e is { message: string } {
    return (
      typeof e === 'object' &&
      e !== null &&
      'message' in e &&
      typeof (e as { message: unknown }).message === 'string'
    )
  }

  const isDisposedError = (e: unknown): boolean =>
    hasMessage(e) && e.message.includes('connection got disposed')

  async function safeRequest<R>(
    method: string,
    params: unknown,
    token?: monaco.CancellationToken
  ): Promise<R | null> {
    if (disposed || token?.isCancellationRequested) return null
    // If the token cancels, just ignore the result when it resolves.
    let canceled = false
    const sub = token?.onCancellationRequested?.(() => {
      canceled = true
    })
    try {
      const p = connection.sendRequest<R>(method, params)
      const res = await p
      return canceled || disposed ? null : res
    } catch (e) {
      if (disposed || isDisposedError(e)) return null
      throw e
    } finally {
      sub?.dispose?.()
    }
  }

  // Register per-URI diagnostics handler
  const uriStr = uri.toString()
  diagHandlers.set(uriStr, (params: PublishDiagnosticsParams) => {
    if (disposed) return
    if (params.uri !== uriStr) return
    const markers = (params.diagnostics ?? []).map((d) => ({
      severity: mapSeverity(d.severity),
      message: d.message ?? '',
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      source: d.source ?? 'asm-lsp',
      code: (d.code as string) ?? undefined,
    }))
    monaco.editor.setModelMarkers(model, 'asm-lsp', markers)
  })

  // initialize (once) + didOpen per model
  const doInitializeOnce = async () => {
    if (!lspInitialized) {
      if (!lspInitPromise) {
        lspInitPromise = connection
          .sendRequest<InitializeResult>('initialize', {
            capabilities: {},
            processId: null,
            rootUri: null,
            workspaceFolders: null,
          })
          .then(() => {
            if (disposed) return
            connection.sendNotification('initialized', {})
            lspInitialized = true
          })
          .catch(() => {
            // ignore on dispose
          })
      }
      await lspInitPromise
    }
  }

  void (async () => {
    await doInitializeOnce()
    if (disposed) return
    connection.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: uri.toString(),
        languageId,
        version: 1,
        text: model.getValue(),
      },
    })
  })()

  // propagate edits
  let version = 1
  const changeSub = model.onDidChangeContent(() => {
    if (disposed) return
    version += 1
    connection.sendNotification('textDocument/didChange', {
      textDocument: { uri: uri.toString(), version },
      contentChanges: [{ text: model.getValue() }],
    })
  })

  // HOVER
  const hoverDisp = monaco.languages.registerHoverProvider(languageId, {
    provideHover: async (_m, pos, token) => {
      const hv = await safeRequest<Hover | null>(
        'textDocument/hover',
        {
          textDocument: { uri: uri.toString() },
          position: { line: pos.lineNumber - 1, character: pos.column - 1 },
        },
        token
      )
      if (!hv) return { contents: [] as monaco.IMarkdownString[] }
      return { contents: lspHoverToMonaco(hv) }
    },
  })

  // COMPLETION
  const compDisp = monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: ['.', '%'],
    provideCompletionItems: async (m, pos, _context, token) => {
      const list = await safeRequest<CompletionList | null>(
        'textDocument/completion',
        {
          textDocument: { uri: uri.toString() },
          position: { line: pos.lineNumber - 1, character: pos.column - 1 },
        },
        token
      )

      const items = list?.items ?? []
      const word = m.getWordUntilPosition(pos)
      const range = new monaco.Range(
        pos.lineNumber,
        word.startColumn,
        pos.lineNumber,
        word.endColumn
      )

      const suggestions: monaco.languages.CompletionItem[] = items.map((i) => ({
        label: String(i.label),
        kind: mapCompletionKind(i.kind),
        insertText:
          i.textEdit && 'newText' in i.textEdit
            ? i.textEdit.newText
            : (i.insertText ?? String(i.label)),
        documentation:
          typeof i.documentation === 'string'
            ? i.documentation
            : i.documentation?.value,
        detail: i.detail,
        range,
      }))

      return { suggestions }
    },
  })

  // DEFINITION
  const defDisp = monaco.languages.registerDefinitionProvider(languageId, {
    provideDefinition: async (_m, pos, token) => {
      const def = await safeRequest<Definition | null>(
        'textDocument/definition',
        {
          textDocument: { uri: uri.toString() },
          position: { line: pos.lineNumber - 1, character: pos.column - 1 },
        },
        token
      )
      return lspDefinitionToMonaco(def, uri)
    },
  })

  return {
    connection,
    dispose() {
      // Dispose providers first so Monaco stops issuing requests
      hoverDisp.dispose()
      compDisp.dispose()
      defDisp.dispose()
      changeSub.dispose()
      disposed = true
      try {
        connection.sendNotification('textDocument/didClose', {
          textDocument: { uri: uriStr },
        })
      } catch {
        // ignore
      }
      // Unregister diagnostics handler for this model
      diagHandlers.delete(uriStr)
      // Potentially tear down shared connection/worker when last user disposes
      releaseSharedConnection()
      monaco.editor.setModelMarkers(model, 'asm-lsp', [])
    },
  }
}

/* ---------- converters & mappers ---------- */
function isLocation(v: unknown): v is Location {
  return !!v && typeof v === 'object' && 'uri' in v && 'range' in v
}
function isLocationLink(v: unknown): v is LocationLink {
  return !!v && typeof v === 'object' && 'targetUri' in v && 'targetRange' in v
}

function lspHoverToMonaco(h: Hover): monaco.IMarkdownString[] {
  if (!h.contents) return []
  if (Array.isArray(h.contents)) {
    return h.contents.map((c) =>
      typeof c === 'string' ? { value: c } : { value: c.value }
    )
  }
  if (typeof h.contents === 'string') return [{ value: h.contents }]
  return [{ value: h.contents.value }]
}

function lspRangeToMonaco(r: LspRange): monaco.IRange {
  return new monaco.Range(
    r.start.line + 1,
    r.start.character + 1,
    r.end.line + 1,
    r.end.character + 1
  )
}

function lspDefinitionToMonaco(
  def: Definition | null,
  fallback: monaco.Uri
): { uri: monaco.Uri; range: monaco.IRange }[] {
  if (!def) return []

  if (Array.isArray(def)) {
    return def.flatMap((item) => {
      if (isLocationLink(item)) {
        return [
          {
            uri: monaco.Uri.parse(item.targetUri),
            range: lspRangeToMonaco(
              item.targetSelectionRange ?? item.targetRange
            ),
          },
        ]
      }
      if (isLocation(item)) {
        return [
          {
            uri: monaco.Uri.parse(item.uri),
            range: lspRangeToMonaco(item.range),
          },
        ]
      }
      return [] // unknown element type
    })
  }

  if (isLocationLink(def)) {
    return [
      {
        uri: monaco.Uri.parse(def.targetUri),
        range: lspRangeToMonaco(def.targetSelectionRange ?? def.targetRange),
      },
    ]
  }

  if (isLocation(def)) {
    return [
      {
        uri: monaco.Uri.parse(def.uri ?? fallback.toString()),
        range: lspRangeToMonaco(def.range),
      },
    ]
  }

  return []
}

function mapSeverity(s?: number): monaco.MarkerSeverity {
  // LSP DiagnosticSeverity: 1=Error, 2=Warning, 3=Information, 4=Hint
  return s === 2
    ? monaco.MarkerSeverity.Warning
    : s === 3
      ? monaco.MarkerSeverity.Info
      : s === 4
        ? monaco.MarkerSeverity.Hint
        : monaco.MarkerSeverity.Error
}

function mapCompletionKind(
  kind?: LspCompletionItemKind
): monaco.languages.CompletionItemKind {
  switch (kind) {
    case LspCompletionItemKind.Keyword:
      return monaco.languages.CompletionItemKind.Keyword
    case LspCompletionItemKind.Variable:
      return monaco.languages.CompletionItemKind.Variable
    case LspCompletionItemKind.Function:
      return monaco.languages.CompletionItemKind.Function
    case LspCompletionItemKind.Field:
      return monaco.languages.CompletionItemKind.Field
    case LspCompletionItemKind.Constant:
      return monaco.languages.CompletionItemKind.Constant
    case LspCompletionItemKind.Class:
      return monaco.languages.CompletionItemKind.Class
    case LspCompletionItemKind.Enum:
      return monaco.languages.CompletionItemKind.Enum
    case LspCompletionItemKind.Property:
      return monaco.languages.CompletionItemKind.Property
    default:
      return monaco.languages.CompletionItemKind.Text
  }
}
