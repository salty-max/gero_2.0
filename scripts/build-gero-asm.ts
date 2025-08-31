#!/usr/bin/env bun
import {
  mkdirSync,
  readdirSync,
  copyFileSync,
  existsSync,
  statSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

type Cmd = { cmd: string; args: string[]; cwd?: string }

async function run({ cmd, args, cwd }: Cmd) {
  const p = Bun.spawn([cmd, ...args], {
    cwd,
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  const code = await p.exited
  if (code !== 0) {
    throw new Error(
      `Command failed (${code}): ${cmd} ${args.join(' ')}${cwd ? ` [cwd=${cwd}]` : ''}`
    )
  }
}

function ensureDir(path: string) {
  try {
    mkdirSync(path, { recursive: true })
  } catch {}
}

function findWasm(dir: string): string | null {
  const files = readdirSync(dir)
  const candidates = files.filter(
    (f) =>
      f.endsWith('.wasm') &&
      (f.startsWith('tree-sitter') || f === 'parser.wasm')
  )
  if (candidates.length === 0) return null
  const preferred = candidates.find((f) => f.toLowerCase().includes('gero'))
  const picked = preferred ?? candidates[0]!
  return resolve(dir, picked)
}

async function main() {
  const repoRoot = resolve(import.meta.dir, '..')

  // 1) Build grammar wasm in packages/asm-grammar
  const asmGrammarDir = resolve(repoRoot, 'packages/asm-grammar')
  console.log('[prep:gero-asm] Building Tree-sitter wasm in', asmGrammarDir)
  await run({
    cmd: 'bunx',
    args: ['--bun', 'tree-sitter', 'build', '--wasm'],
    cwd: asmGrammarDir,
  })

  const wasmPath = findWasm(asmGrammarDir)
  if (!wasmPath || !existsSync(wasmPath)) {
    throw new Error('Could not find built wasm in packages/asm-grammar')
  }

  // 2) Build LSP CLI in packages/asm-lsp
  const asmLspDir = resolve(repoRoot, 'packages/asm-lsp')
  console.log('[prep:gero-asm] Building LSP CLI in', asmLspDir)
  await run({ cmd: 'bun', args: ['run', 'build:cli'], cwd: asmLspDir })

  const builtCli = resolve(asmLspDir, 'dist/cli.js')
  if (!existsSync(builtCli) || !statSync(builtCli).isFile()) {
    throw new Error('Expected LSP CLI at packages/asm-lsp/dist/cli.js')
  }

  // 3) Copy artifacts into packages/gero-asm
  const geroAsmDir = resolve(repoRoot, 'packages/gero-asm')
  const wasmDestDir = resolve(geroAsmDir, 'wasm')
  const serverDestDir = resolve(geroAsmDir, 'server')
  ensureDir(wasmDestDir)
  ensureDir(serverDestDir)

  const wasmDest = resolve(wasmDestDir, 'gero_asm.wasm')
  const serverDest = resolve(serverDestDir, 'asm-lsp.js')

  console.log('[prep:gero-asm] Copying wasm ->', wasmDest)
  copyFileSync(wasmPath, wasmDest)

  console.log('[prep:gero-asm] Copying LSP ->', serverDest)
  copyFileSync(builtCli, serverDest)

  console.log('[prep:gero-asm] Done.')
}

main().catch((err) => {
  console.error('[prep:gero-asm] Error:', err?.message || err)
  process.exit(1)
})
