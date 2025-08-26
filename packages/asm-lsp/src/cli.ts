#!/usr/bin/env node
import * as net from 'node:net'
import * as process from 'node:process'

import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'

import { wireServer } from './server-core'

type Mode = 'stdio' | 'tcp'
const args = new Set(process.argv.slice(2))
const mode: Mode = args.has('--tcp') ? 'tcp' : 'stdio'
const port = Number(process.env.GERO_ASM_LSP_PORT || '7342')

if (mode === 'stdio') {
  const connection = createConnection(ProposedFeatures.all)
  wireServer(connection)
  connection.listen()
} else {
  const server = net.createServer((socket) => {
    const connection = createConnection(
      new StreamMessageReader(socket),
      new StreamMessageWriter(socket)
    )
    wireServer(connection)
    connection.listen()
  })

  server.listen(port, '127.0.0.1', () => {
    console.error(`[gero-asm-lsp] listening on tcp://127.0.0.1:${port}`)
  })
}
