import { GithubIcon } from 'lucide-react'
import { ModeToggle } from './mode-toggle'
import { CRTToggle } from './crt-toggle'
import { Button } from './ui/button'

import GeroLogoRaw from '/src/assets/gero-logo.svg?raw'

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-background">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-6 w-auto text-gero [&>svg]:h-full [&>svg]:w-auto"
          dangerouslySetInnerHTML={{ __html: GeroLogoRaw }}
        />
        <h1 className="text-2xl">
          <span className="text-gero font-bold">GTX</span>
          <span>-16</span>
        </h1>
      </div>
      <nav className="flex gap-3">
        <div className="flex items-center gap-2">
          <CRTToggle />
          <ModeToggle />
        </div>
        <a
          href="https://github.com/salty-max/gero_2.0/tree/main/apps/gtx-16"
          target="_blank"
        >
          <Button variant="outline">
            <GithubIcon className="h-4 w-4" />
            Source Code
          </Button>
        </a>
      </nav>
    </header>
  )
}
