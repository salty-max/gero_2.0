import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { assemble, type AssembleResult } from '@gero/asm'
import { useVM } from './vm-context'

export type ProgramCompile = {
  bytes: Uint8Array
  symbols: Record<string, number>
  sourceMap: AssembleResult['sourceMap']
  defs: AssembleResult['defs']
  errors: AssembleResult['diags']['errors']
}

export type ProgramApi = {
  getSource(): string
  setSource(src: string): void
  compile(src?: string): ProgramCompile
  lastCompile: ProgramCompile | null
  programBase: number // absolute base address program bytes were loaded at
  entry: number
  setEntry(n: number): void
  loadToVM(opts?: {
    start?: number
    entry?: number
    compiled?: ProgramCompile
  }): void
}

const ProgramContext = createContext<ProgramApi | null>(null)

export type ProgramProviderProps = {
  children: React.ReactNode
}

export function ProgramProvider({ children }: ProgramProviderProps) {
  const vm = useVM()
  const sourceRef = useRef<string>('')
  const [lastCompile, setLastCompile] = useState<ProgramCompile | null>(null)
  const [programBase, setProgramBase] = useState<number>(0)
  const [entry, setEntryState] = useState<number>(0)

  const getSource = useCallback(() => sourceRef.current, [])
  const setSource = useCallback((src: string) => {
    sourceRef.current = src
  }, [])

  const compile = useCallback((src?: string): ProgramCompile => {
    const text = src ?? sourceRef.current
    const res = assemble(text)
    const out: ProgramCompile = {
      bytes: new Uint8Array([...res.bytes]),
      symbols: res.symbols,
      sourceMap: res.sourceMap,
      defs: res.defs,
      errors: res.diags.errors,
    }
    setLastCompile(out)
    return out
  }, [])

  const setEntry = useCallback(
    (n: number) => {
      setEntryState(n)
      vm.setEntry(n)
    },
    [vm]
  )

  const loadToVM = useCallback(
    async (opts?: {
      start?: number
      entry?: number
      compiled?: ProgramCompile
    }) => {
      const compiled = opts?.compiled ?? compile()
      if (compiled.bytes.length === 0 || compiled.errors.length) return

      const start = opts?.start ?? 0x0000
      const startOffset = compiled.symbols['start'] // offset within program, if present
      let computedEntry: number

      if (opts?.entry) {
        // explicit entry point
        computedEntry = opts.entry
      } else if (typeof startOffset === 'number') {
        computedEntry = start + startOffset
      } else {
        computedEntry = await vm.getEntry()
      }

      vm.load(compiled.bytes, start, computedEntry)
      setEntry(computedEntry)
      // Compute and persist absolute base for disassembly views
      const base =
        typeof startOffset === 'number'
          ? (computedEntry - startOffset) & 0xffff
          : start
      setProgramBase(base)
    },
    [compile, vm, setEntry]
  )

  const api: ProgramApi = useMemo(
    () => ({
      getSource,
      setSource,
      compile,
      lastCompile,
      programBase,
      entry,
      setEntry,
      loadToVM,
    }),
    [
      getSource,
      setSource,
      compile,
      lastCompile,
      programBase,
      entry,
      setEntry,
      loadToVM,
    ]
  )

  return (
    <ProgramContext.Provider value={api}>{children}</ProgramContext.Provider>
  )
}

export function useProgram(): ProgramApi {
  const ctx = useContext(ProgramContext)
  if (!ctx) throw new Error('useProgram must be used within <ProgramProvider>')
  return ctx
}
