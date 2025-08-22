import { type useVM } from '@/hooks/use-vm'
import { RegistersPane } from './panes/register-pane'
import { SectionCard } from './section-card'
import { MemoryPane } from './panes/memory-pane'
import { useEffect, useState } from 'react'
import { u16 } from '@gero/util'
import { LogPane } from './panes/log-pane'
import { useVMLog } from '@/hooks/use-vm-log'

type CockpitProps = {
  vm: ReturnType<typeof useVM>
}

export function Cockpit({ vm }: CockpitProps) {
  const [bps, _setBps] = useState<number[]>([])
  const [memBase, setMemBase] = useState(0x0000)
  const [_disBase, setDisBase] = useState(0x0000)
  const [followIP, _setFollowIP] = useState(true)
  const [followSP, setFollowSP] = useState(true)

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
      <div className="flex gap-3">
        <MemoryPane
          vm={vm}
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
        <SectionCard title="Registers" className="flex-1">
          <RegistersPane
            regs={vm.snap?.regs ?? null}
            onEdit={(name, value) => vm.setReg(name, value)}
          />
        </SectionCard>
        <SectionCard title="Stack memory" className="flex-2">
          Here lies stack memory
        </SectionCard>
        <SectionCard title="Assembly code" className="flex-auto">
          Here lies dissasembler
        </SectionCard>
      </div>
      <LogPane
        entries={log.entries}
        clear={log.clear}
        copy={log.copytoClipboard}
        height={180}
      />
    </main>
  )
}
