import { useVM } from '@/contexts/vm-context'
import { RegistersPane } from './panes/register-pane'
import { SectionCard } from './section-card'
import { MemoryPane } from './panes/memory-pane'
import { useEffect, useState } from 'react'
import { u16 } from '@gero/util'
import { LogPane } from './panes/log-pane'
import { useVMLog } from '@/hooks/use-vm-log'
import { AssemblyPane } from './panes/assembly-pane'

export function Cockpit() {
  const vm = useVM()
  const [bps, _setBps] = useState<number[]>([])
  const [memBase, setMemBase] = useState(0x0000)
  const [_disBase, setDisBase] = useState(0x0000)
  const [followIP, _setFollowIP] = useState(true)
  const [followSP, setFollowSP] = useState(false)

  const log = useVMLog(
    vm.on,
    { includeTick: false, tickSample: 64, max: 1000 },
    vm.ready
  )

  // Keep worker in sync with local BP state
  useEffect(() => {
    if (vm.ready) vm.setBreakpoints(bps)
  }, [vm, bps])

  // Follow IP / SP
  useEffect(() => {
    if (!vm.snap) return
    if (followIP) setDisBase(vm.snap.ip)
    if (followSP) setMemBase(u16(vm.snap.sp - 0x40))
  }, [vm.snap, followIP, followSP])

  return (
    <main className="flex flex-col gap-3 px-6 h-[calc(100vh - 68px - 32px)]">
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
          <SectionCard title="Stack memory">Here lies stack memory</SectionCard>
          <AssemblyPane />
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
    </main>
  )
}
