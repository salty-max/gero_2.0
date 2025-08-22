import type { useVM } from '@/hooks/use-vm'
import { ModeToggle } from './mode-toggle'
import { Button } from './ui/button'
import {
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  StepForwardIcon,
  UploadIcon,
} from 'lucide-react'

type ToolbarProps = {
  vm: ReturnType<typeof useVM>
}

export function Toolbar({ vm }: ToolbarProps) {
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
        <Button size="sm" onClick={vm.run}>
          <PlayIcon />
          Run
        </Button>
        <Button size="sm" onClick={vm.pause}>
          <PauseIcon />
          Pause
        </Button>
        <Button size="sm" onClick={() => vm.step(1)}>
          <StepForwardIcon />
          Step
        </Button>
        <Button size="sm" onClick={vm.reset}>
          <RotateCcwIcon />
          Reset
        </Button>
      </div>
      <ModeToggle />
    </header>
  )
}
