import { useVM } from '@/contexts/vm-context'
import { ModeToggle } from './mode-toggle'
import { Button } from './ui/button'
import {
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  StepForwardIcon,
} from 'lucide-react'
import { fmt16, u16 } from '@gero/util'
import { Separator } from './ui/separator'
import { useEffect, useState } from 'react'
import { Slider } from './ui/slider'
import { Label } from './ui/label'
import { HexInput } from './ui/hex-input'
import { ProgramEditor } from './program-editor'
import { useProgram } from '@/contexts/program-context'

import GeroLogo from '/src/assets/gero-logo.svg'

export function Toolbar() {
  const vm = useVM()
  const program = useProgram()
  const [delay, setDelay] = useState(500)
  const [entryHex, setEntryHex] = useState('0000')

  // keep input in sync with ProgramContext.entry
  useEffect(() => {
    setEntryHex(fmt16(u16(program.entry), true))
  }, [program.entry])

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <img src={GeroLogo} alt="GeroLab Logo" className="h-6 w-auto" />
        <h1 className="text-2xl">
          <span className="text-gero font-bold">Gero</span>
          <span>Lab</span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <ProgramEditor />
        <div className="flex items-center gap-2">
          <Label>Start @</Label>
          <HexInput
            name="startIp"
            value={entryHex}
            onEnter={(s) => {
              const v = parseInt(s, 16)
              if (!Number.isNaN(v)) {
                const vv = u16(v)
                setEntryHex(fmt16(vv, true))
                program.setEntry(vv)
              }
            }}
          />
        </div>
        <Separator orientation="vertical" />
        <div className="flex items-center gap-2">
          <Label>Delay (ms)</Label>
          <Slider
            id="delayMs"
            name="delayMs"
            min={0}
            max={3000}
            step={50}
            value={[delay]}
            className="w-30"
            onValueChange={(vals) => {
              const v = Array.isArray(vals) && vals.length ? vals[0]! : 0
              const val = Number.isFinite(v) ? v : 0
              setDelay(val)
              vm.setStepDelay(val)
            }}
          />
          <span className="text-xs tabular-nums w-8 text-right">{delay}</span>
        </div>
      </div>
      <div className="flex gap-4 items-center h-full">
        <nav className="flex gap-3">
          <Button onClick={vm.run} disabled={!vm.ready || vm.running}>
            {vm.running ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <PlayIcon />
            )}
            Run
          </Button>
          <Button
            variant="destructive"
            onClick={vm.pause}
            disabled={!vm.ready || !vm.running}
          >
            <PauseIcon />
            Pause
          </Button>
          <Button onClick={() => vm.step(1)} disabled={!vm.ready || vm.running}>
            <StepForwardIcon />
            Step
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              vm.reset()
              vm.setEntry(program.entry)
            }}
            disabled={!vm.ready && vm.running}
          >
            <RotateCcwIcon />
            Reset
          </Button>
        </nav>
        <Separator orientation="vertical" />

        <ModeToggle />
      </div>
    </header>
  )
}
