import { useState } from 'react'
import { AsmEditor } from './asm-editor'
import { useProgram } from '@/contexts/program-context'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet'
import { Button } from './ui/button'
import { CodeIcon } from 'lucide-react'

export function ProgramEditor() {
  const [open, setOpen] = useState(false)
  const program = useProgram()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <CodeIcon />
          Load Program
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[800px]">
        <SheetHeader>
          <SheetTitle>Program Editor</SheetTitle>
          <SheetDescription>
            Write your assembly program here. The editor supports syntax
            highlighting, code completion, and error reporting.
          </SheetDescription>
        </SheetHeader>
        <div className="flex items-center gap-2 py-2">
          <Button
            variant="default"
            onClick={() => {
              const res = program.compile()
              if (res.errors.length) {
                console.log('Compile errors', res.errors)
                return
              }
              program.loadToVM({ compiled: res })
            }}
          >
            Assemble & Load
          </Button>
        </div>
        {open && (
          <AsmEditor height={'100%'} className="w-full h-full bg-gray-900" />
        )}
      </SheetContent>
    </Sheet>
  )
}
