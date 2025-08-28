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
import { useTheme } from '@/components/theme-provider'

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
  initialValue = '; Start coding or select a sample program',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const uri = useMemo(() => monaco.Uri.parse(uriStr), [uriStr])
  const { mnemonics, registers } = ISA
  const program = useProgram()
  const { theme } = useTheme()
  const modelRef = useRef<monaco.editor.ITextModel | null>(null)
  const suppressSetRef = useRef(false)

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
    modelRef.current = model
    // If reusing an existing model, ensure it reflects the current source once at mount
    if (existing && seed !== model.getValue()) {
      suppressSetRef.current = true
      try {
        model.setValue(seed)
      } finally {
        suppressSetRef.current = false
      }
    }

    const editor = monaco.editor.create(containerRef.current, {
      model,
      minimap: { enabled: false },
      automaticLayout: true,
      theme:
        theme === 'dmg'
          ? 'gero-dmg'
          : theme === 'basic'
            ? 'gero-basic'
            : theme === 'matrix'
              ? 'gero-matrix'
              : theme === 'dark'
                ? 'gero-mocha'
                : 'gero-latte',
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
      if (suppressSetRef.current) return
      program.setSource(model.getValue())
    })

    return () => {
      lsp.dispose()
      editor.dispose()
      sub.dispose()
      // Do NOT dispose the model so content persists across sheet toggles
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, mnemonics, registers, initialValue, theme, program.setSource])

  // Reflect ProgramContext source changes into the editor model without
  // recreating the editor or triggering feedback loops.
  useEffect(() => {
    const m = modelRef.current
    if (!m) return
    const src =
      program.getSource() && program.getSource().length > 0
        ? program.getSource()
        : initialValue
    if (src !== m.getValue()) {
      suppressSetRef.current = true
      try {
        m.setValue(src)
      } finally {
        // allow next user edits to sync back
        suppressSetRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program.getSource, initialValue])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    />
  )
}
