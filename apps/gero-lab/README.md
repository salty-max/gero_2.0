# GeroLab

GeroLab is a web UI for exploring, editing, and running assembly programs on the Gero 16‑bit VM. It provides an editor with LSP features, a live VM cockpit (memory/stack/registers/logs), and controls to run, step, and inspect execution.

- Editor: Monaco-based with syntax highlighting, hover, completion, go-to-definition, and diagnostics via an in-browser LSP.
- Cockpit: Memory viewer, stack view, disassembly, registers panel, and a structured log with filters.
- Controls: Run/Pause, Step, Reset, entry point selection, delay control.
- A11y/UX: Icon-only buttons with tooltips, keyboard focus styles, and screen-reader labels.

This app lives in a monorepo alongside the core packages (`@gero/vm`, `@gero/asm-lsp`, `@gero/disasm`, `@gero/util`).

## Quick Start

Prereqs: Bun (recommended) or Node.js, and a package manager.

From repo root:

```bash
# install once at the root
bun install

# run the app with dependencies built
cd apps/gero-lab
bun run dev

# open http://localhost:1337
```

The app prebuilds the workspace packages via Turbo (see `predev`/`prebuild` scripts). If you prefer npm/pnpm, use their equivalents (`npm run dev`, etc.) after installing deps.

## Building

```bash
cd apps/gero-lab
bun run build
# preview a production build locally
bun run preview
```

Build notes:

- Monaco editor is lazy‑loaded and split into its own chunk.
- Vendor chunking groups `react`, `radix`, `monaco`, `lsp`, and `icons` for predictable sizes.
- Chunk warning limit is adjusted to account for Monaco’s size; it only loads when the editor opens.

## Testing

```bash
cd apps/gero-lab
bun run test
```

There is an integration test for the VM worker (`__tests__/vm.worker.spec.ts`) that exercises memory ops, breakpoints, faults, and snapshots.

## Architecture Overview

- VM Worker: `src/lib/vm.service.ts` and `src/lib/vm.worker.ts`
  - Runs the CPU, memory mapper, and execution loop off the main thread.
  - Emits protocol events (`ready`, `run`, `paused`, `tick`, `snapshot`, `mem`, `bp`, `irq`, `im`).
  - `mem` events represent reads (peek snapshots) only.

- Editor + LSP: `src/components/asm-editor.tsx`, `src/lib/asm-lsp-monaco.ts`, `src/lib/asm-monarch.ts`
  - Monaco configured via the minimal `editor.api` entry (no built-in languages).
  - LSP connection uses `vscode-jsonrpc` in a web worker for hovers, completion, definitions, and diagnostics.
  - Monarch tokenizer defines highlighting and themes.

- UI Components: `src/components/ui/*`
  - Radix primitives (dropdown, tooltip, sheet, etc.).
  - `IconButton` wraps a `Button` with tooltip + a11y attributes; supports `asChild` for Radix triggers.

- Cockpit: `src/components/cockpit.tsx` and panes under `src/components/panes/*`
  - Memory pane: paged view with highlight regions and ASCII rendering.
  - Stack pane: down‑growing stack with frame detection (locals vs saved registers).
  - Disassembly: source‑aware disassembler with code/data region hints and breakpoints.
  - Logs: typed entries with inline, non‑JSON details chips (snapshot, stack deltas, faults, mem, paused, load).

## Common Workflows

- Load a program: Use “Load Program” to open the Monaco editor, write assembly, “Assemble & Load”.
- Run and step: Use toolbar controls; adjust delay to slow down execution.
- Add/remove breakpoints: Double‑click a row in the Disassembly pane.
- Inspect memory: Use Memory pane “Jump @” to navigate; bytes and ASCII columns update live.
- Filter logs: Use the filter menu in the Logs pane; expand into a side sheet if you need more room.

## Accessibility & UX

- Icon-only actions use `IconButton` with `label`, `aria-label`, `title`, and an sr-only span.
- Tooltips wrap Radix triggers using `TooltipTrigger asChild` around `DropdownMenuTrigger asChild`.
- Page scroll is disabled; internal `ScrollArea`s handle scrolling to avoid layout shifts.

## Troubleshooting

- Large chunks warning: Monaco is split into a lazy chunk; warnings are suppressed by a higher `chunkSizeWarningLimit`.
- Missing hovers/completions: Ensure the LSP worker attaches early (it is wired in `AsmEditor`). If issues persist, hard refresh to clear cached chunks.
- VM tests failing: `mem` events are for reads only; writes (poke) no longer emit `mem`.

## Contributing

PRs and issues are welcome. For larger changes, consider opening an issue to discuss architecture first (e.g., new VM events, editor features, or chunking strategy).

## License

See the repository root for license information.
