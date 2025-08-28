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
import { SAMPLES } from '@/samples'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

type ProgramEditorProps = {
  label?: string
}

export function ProgramEditor({ label }: ProgramEditorProps) {
  const [open, setOpen] = useState(false)
  const program = useProgram()
  const [selected, setSelected] = useState<string>('')
  const [editorKey, setEditorKey] = useState(0) // to force remount editor

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <CodeIcon />
          {label ?? 'Load Program'}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-1/2 h-full flex flex-col gap-4 bg-background"
      >
        <div className="px-4 pt-4">
          <SheetHeader>
            <SheetTitle>Program Editor</SheetTitle>
            <SheetDescription>
              Write your assembly program here. The editor supports syntax
              highlighting, code completion, and error reporting.
            </SheetDescription>
          </SheetHeader>
        </div>
        <div className="flex items-center gap-3 px-6">
          <div className="flex items-center gap-2 text-sm">
            <Select
              value={selected}
              onValueChange={(v) => {
                setSelected(v)
                const s = SAMPLES.find((x) => x.id === v)
                if (s) {
                  program.setSource(s.code)
                  setEditorKey((k) => k + 1)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder="Select sample program"
                  defaultValue="hello"
                />
              </SelectTrigger>
              <SelectContent>
                {SAMPLES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Sample loads on selection; no separate button needed */}
          </div>
          <Button
            onClick={() => {
              const res = program.compile()
              if (res.errors.length) {
                console.log('Compile errors', res.errors)
                return
              }
              program.loadToVM({ compiled: res })
              setOpen(false)
            }}
          >
            Assemble & Load
          </Button>
        </div>
        <div className="flex-1 min-h-0 pr-6 pt-4 pb-6">
          {open && (
            <AsmEditor
              key={editorKey}
              height={'100%'}
              className="w-full h-full bg-gray-900 rounded"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
