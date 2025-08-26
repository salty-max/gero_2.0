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
import { useProgram } from '@/contexts/program-context'
import { StackPane } from './panes/stack-pane'

export function Cockpit() {
  const vm = useVM()
  const program = useProgram()
  const [memBase, setMemBase] = useState(0x0000)
  const [followIP, _setFollowIP] = useState(true)
  const [followSP, setFollowSP] = useState(false)

  const log = useVMLog(
    vm.on,
    { includeTick: false, tickSample: 64, max: 1000 },
    vm.ready
  )

  // ProgramProvider syncs breakpoints to the VM

  // Follow IP / SP
  useEffect(() => {
    if (!vm.snap) return
    if (followIP) setMemBase(u16(vm.snap.ip - 0x20))
    if (followSP) setMemBase(u16(vm.snap.sp - 0x40))
  }, [vm.snap, followIP, followSP])

  // Determine whether a program is considered "loaded".
  // We rely on the presence of an initial snapshot; prior to the first
  // snapshot the UI is blurred & an overlay is shown.
  const loaded = vm.snap != null

  return (
    <ScrollArea>
      <main className={cn('relative px-6 max-h-[calc(100vh-68px-40px)]')}>
        {!loaded && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/70 backdrop-blur-sm">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold">No program loaded</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Use the &quot;Load Program&quot; button in the toolbar above to
                load a sample program, or load your own binary. The cockpit will
                update once the first snapshot arrives.
              </p>
            </div>
          </div>
        )}

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
                setFollowSP(false)
              }}
            />
            <div className="grid grid-rows-2 md:grid-rows-none md:grid-cols-2 xl:grid-cols-none xl:grid-rows-[1fr_2fr] 2xl:grid-rows-none 2xl:grid-cols-2 gap-3">
              <StackPane />
              <AssemblyPane
                breakpoints={program.breakpoints}
                onToggleBreakpoint={(addr) => program.toggleBreakpoint(addr)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-[1fr_2fr] gap-3">
            <RegistersPane
              regs={vm.snap?.regs ?? null}
              onEdit={(name, value) => vm.setReg(name, value)}
            />
            <LogPane
              entries={log.entries}
              clear={log.clear}
              copy={log.copytoClipboard}
            />
          </div>
        </div>
      </main>
    </ScrollArea>
  )
}
