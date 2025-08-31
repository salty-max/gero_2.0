# gero-asm Zed language package

Zed extension providing Gero ASM language support using Tree-sitter for syntax and the asm LSP for smart features.

Contents

- `extension.toml`: Zed extension manifest
- `wasm/gero_asm.wasm`: expected Tree-sitter wasm (place the built grammar here)
- Uses queries from `@gero/asm-grammar/queries/highlights.scm`

Usage

1) Build the grammar wasm
- Install tree-sitter CLI
- In `packages/asm-grammar`: `tree-sitter build-wasm`
- Copy/rename the output to `packages/zed-asm/wasm/gero_asm.wasm`

2) Open the repo in Zed
- Zed will load this extension (or use the local `.zed` one if preferred)
- Ensure `bun` is on PATH (the LSP is launched via `bun packages/asm-lsp/src/cli.ts`)

Notes

- You can keep both this package and the local `.zed/extensions/gero-asm` for experimentation. This package is better for distribution; the `.zed` version is a quick local setup.
