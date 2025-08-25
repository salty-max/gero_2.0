import * as path from 'path'
import * as vscode from 'vscode'
import { LanguageClient, TransportKind } from 'vscode-languageclient/node'
let client: LanguageClient

export function activate(ctx: vscode.ExtensionContext) {
  const modulePath = ctx.asAbsolutePath(path.join('dist', 'server-node.js'))
  client = new LanguageClient(
    'gero-asm-lsp',
    'Gero ASM Language Server',
    {
      run: { module: modulePath, transport: TransportKind.stdio },
      debug: {
        module: modulePath,
        transport: TransportKind.stdio,
        options: { execArgv: ['--inspect=6009'] },
      },
    },
    { documentSelector: [{ language: 'gero-asm' }] }
  )
  client.start()
}

export function deactivate() {
  return client?.stop()
}
