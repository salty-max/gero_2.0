import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { SettingsIcon } from 'lucide-react'

type Props = {
  codeOnly: boolean
  setCodeOnly: (v: boolean) => void
  showBytes: boolean
  setShowBytes: (v: boolean) => void
}

export function AssemblyOptions({
  codeOnly,
  setCodeOnly,
  showBytes,
  setShowBytes,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Display</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={codeOnly}
          onCheckedChange={(v) => setCodeOnly(Boolean(v))}
          onSelect={(e) => e.preventDefault()}
        >
          code only
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showBytes}
          onCheckedChange={(v) => setShowBytes(Boolean(v))}
          onSelect={(e) => e.preventDefault()}
        >
          show bytes
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
