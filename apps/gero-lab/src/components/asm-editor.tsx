import { useEffect, useMemo, useRef } from 'react'
import * as monaco from 'monaco-editor'
import { installMonacoWorkers } from '@/lib/monaco-setup'
import {
  attachAsmLspToModel,
  ensureAsmLanguageRegistered,
} from '@/lib/asm-lsp-monaco'
import { ISA } from '@gero/asm-lsp'
import LspWorker from '@/lib/asm-lsp.worker.ts?worker'
import { registerAsmMonarch } from '@/lib/asm-monarch'
import { useProgram } from '@/contexts/program-context'

type Props = {
  height?: number | string
  className?: string
  uri?: string
  initialValue?: string
}

export function AsmEditor({
  height = 260,
  className = '',
  uri: uriStr = 'inmemory://model.gasm',
  initialValue = [
    'const TOTO = $DEAD',
    '+data8 myRect = {$08, $08, $10, $10}',
    '',
    'struct Rectangle {',
    '  x: $01,',
    '  y: $01,',
    '  w: $01,',
    '  h: $01,',
    '}',
    '',
    'start:',
    '  mov8 &[<Rectangle> myRect.w], r1',
    '  mov8 &[<Rectangle> myRect.h], r2',
    '  mul r1, r2',
    '  add !TOTO, acc',
    '  hlt',
  ].join('\n'),
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const uri = useMemo(() => monaco.Uri.parse(uriStr), [uriStr])
  const { mnemonics, registers } = ISA
  const program = useProgram()

  useEffect(() => {
    installMonacoWorkers()
    if (!containerRef.current) return

    ensureAsmLanguageRegistered('gero-asm')
    registerAsmMonarch('gero-asm', { mnemonics, registers })

    // Reuse existing model if present; otherwise seed from ProgramContext source
    // to persist edits across open/close. Fallback to initialValue if no source yet.
    const existing = monaco.editor.getModel(uri)
    const seed =
      program.getSource() && program.getSource().length > 0
        ? program.getSource()
        : initialValue
    const model = existing || monaco.editor.createModel(seed, 'gero-asm', uri)

    const editor = monaco.editor.create(containerRef.current, {
      model,
      minimap: { enabled: false },
      automaticLayout: true,
      theme: 'gero-mocha',
      fontSize: 16,
      lineHeight: 24,
      fontFamily: "'JetBrains Mono', monospace",
      // Wrap at 80 columns and show a ruler
      wordWrap: 'wordWrapColumn',
      wordWrapColumn: 80,
      wrappingIndent: 'same',
      rulers: [80],
    })

    const lsp = attachAsmLspToModel({
      model,
      workerCtor: LspWorker as unknown as { new (): Worker },
      languageId: 'gero-asm',
    })

    // Sync source to ProgramContext
    program.setSource(model.getValue())
    const sub = model.onDidChangeContent(() => {
      program.setSource(model.getValue())
    })

    return () => {
      lsp.dispose()
      editor.dispose()
      sub.dispose()
      // Do NOT dispose the model so content persists across sheet toggles
    }
  }, [uri, mnemonics, registers, initialValue, program])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    />
  )
}
