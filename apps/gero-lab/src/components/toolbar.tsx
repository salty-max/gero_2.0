import { u16, fmt16 } from '@gero/util'
import {
  Loader2Icon,
  PlayIcon,
  PauseIcon,
  StepForwardIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { ProgramEditor } from './program-editor'
import { Button } from './ui/button'
import { HexInput } from './ui/hex-input'
import { Label } from './ui/label'
import { Separator } from './ui/separator'
import { Slider } from './ui/slider'
import { useProgram } from '@/contexts/program-context'
import { useVM } from '@/contexts/vm-context'
import { useEffect, useState } from 'react'

export function ToolBar() {
  const program = useProgram()
  const vm = useVM()
  const [delay, setDelay] = useState(500)
  const [entryHex, setEntryHex] = useState('0000')

  // keep input in sync with ProgramContext.entry
  useEffect(() => {
    setEntryHex(fmt16(u16(program.entry), true))
  }, [program.entry])

  return (
    <nav className="flex items-center justify-between gap-2">
      <ProgramEditor label="Edit Program" />
      <div className="flex items-center gap-4 h-full">
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
      <div className="flex gap-3">
        <Button onClick={vm.run} disabled={!vm.ready || vm.running}>
          {vm.running ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
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
          onClick={() => {
            vm.reset()
            vm.setEntry(program.entry)
          }}
          disabled={!vm.ready && vm.running}
        >
          <RotateCcwIcon />
          Reset
        </Button>
      </div>
    </nav>
  )
}
