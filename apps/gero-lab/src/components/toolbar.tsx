import { useVM } from '@/contexts/vm-context'
import { ModeToggle } from './mode-toggle'
import { Button } from './ui/button'
import {
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  StepForwardIcon,
  UploadIcon,
} from 'lucide-react'
import { fmt16, u16 } from '@gero/util'
import { Separator } from './ui/separator'
import { useState } from 'react'
import { Slider } from './ui/slider'
import { Label } from './ui/label'
import { HexInput } from './ui/hex-input'

export function Toolbar() {
  const vm = useVM()
  const [delay, setDelay] = useState(500)
  const [entry, setEntry] = useState('0000')

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <img
          src="/src/assets/gero-logo.svg"
          alt="GeroLab Logo"
          className="h-6 w-auto"
        />
        <h1 className="text-2xl">
          <span className="text-gero font-bold">Gero</span>
          <span>Lab</span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            vm.load(
              new Uint8Array([
                0xca, 0xfe, 0x00, 0xbe, 0x00, 0xef, 0x10, 0x00, 0x42, 0x02,
                0x10, 0x00, 0x35, 0x03, 0x1c, 0x02, 0x03, 0xff,
              ]),
              0x0000
            )
          }
        >
          <UploadIcon />
          Load Program
        </Button>
        <div className="flex items-center gap-2">
          <Label>Start @</Label>
          <HexInput
            name="startIp"
            value={entry}
            onEnter={(s) => {
              const v = parseInt(s, 16)
              if (!Number.isNaN(v)) {
                setEntry(fmt16(u16(v), true))
                vm.setEntry(u16(v))
              }
            }}
          />
        </div>
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
      <div className="flex gap-3 items-center">
        <nav className="flex gap-3">
          <Button onClick={vm.run}>
            <PlayIcon />
            Run
          </Button>
          <Button onClick={vm.pause}>
            <PauseIcon />
            Pause
          </Button>
          <Button onClick={() => vm.step(1)}>
            <StepForwardIcon />
            Step
          </Button>
          <Button onClick={vm.reset}>
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
