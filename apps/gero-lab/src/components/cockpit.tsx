import { useVM } from '@/contexts/vm-context'
import { RegistersPane } from './panes/register-pane'
import { MemoryPane } from './panes/memory-pane'
import { useEffect, useState } from 'react'
import { u16 } from '@gero/util'
import { LogPane } from './panes/log-pane'
import { useVMLog } from '@/hooks/use-vm-log'
import { AssemblyPane } from './panes/assembly-pane'
import { cn } from '@/lib/utils'
import { ScrollArea } from './ui/scroll-area'
import { StackPane } from './panes/stack-pane'
import { ProgramEditor } from './program-editor'
import { ToolBar } from './toolbar'

export function Cockpit() {
  const vm = useVM()
  const [breakpoints, setBreakpoints] = useState<number[]>([])
  const [memBase, setMemBase] = useState(0x0000)

  const log = useVMLog(
    vm.on,
    { includeTick: false, includeStack: true, tickSample: 64, max: 1000 },
    vm.ready
  )

  // Sync breakpoints to VM
  useEffect(() => {
    vm.setBreakpoints(breakpoints)
  }, [vm, breakpoints])

  // Determine whether a program is considered "loaded".
  // We rely on the presence of an initial snapshot; prior to the first
  // snapshot the UI is blurred & an overlay is shown.
  const loaded = vm.snap != null

  return (
    <div className="flex flex-col gap-4">
      <ScrollArea>
        <main className={cn('relative px-6 max-h-[calc(100vh-68px-40px)]')}>
          {!loaded && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-background/70 backdrop-blur-sm">
              <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold">No program loaded</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Use the &quot;Load Program&quot; button to create or load a
                  program. The cockpit will update once the first snapshot
                  arrives.
                </p>
              </div>
              <ProgramEditor />
            </div>
          )}
          <div className="sticky top-0 left-0 py-4 z-10 bg-background">
            <ToolBar />
          </div>

          <div
            className={cn(
              'flex flex-col gap-3 h-full transition-all duration-200',
              // Apply visual de-emphasis when not loaded
              !loaded && 'blur-sm pointer-events-none select-none'
            )}
          >
            <div className="grid grid-rows-2 xl:grid-rows-none xl:grid-cols-2 2xl:grid-cols-2 gap-3">
              <MemoryPane
                base={memBase}
                length={256}
                highlightAddrs={[vm.snap?.ip, vm.snap?.fp].filter(
                  (x): x is number => typeof x === 'number'
                )}
                onJump={(addr) => {
                  setMemBase(u16(addr))
                }}
              />
              <div className="grid grid-rows-2 md:grid-rows-none md:grid-cols-2 xl:grid-cols-none xl:grid-rows-[1fr_2fr] 2xl:grid-rows-none 2xl:grid-cols-2 gap-3">
                <StackPane />
                <AssemblyPane
                  breakpoints={breakpoints}
                  onToggleBreakpoint={(addr) => {
                    setBreakpoints((bps) =>
                      bps.includes(addr)
                        ? bps.filter((b) => b !== addr)
                        : [...bps, addr].sort((a, b) => a - b)
                    )
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-[1fr_2fr] gap-3">
              <RegistersPane
                regs={vm.snap?.regs ?? null}
                onEdit={(name, value) => vm.setReg(name, value)}
              />
              <LogPane
                entries={log.filteredEntries}
                clear={log.clear}
                copy={log.copytoClipboard}
                filters={log.filters}
                setFilters={log.setFilters}
              />
            </div>
          </div>
        </main>
      </ScrollArea>
    </div>
  )
}
