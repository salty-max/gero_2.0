import { ModeToggle } from './mode-toggle'

import GeroLogo from '/src/assets/gero-logo.svg'

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <img src={GeroLogo} alt="GeroLab Logo" className="h-6 w-auto" />
        <h1 className="text-2xl">
          <span className="text-gero font-bold">Gero</span>
          <span>Lab</span>
        </h1>
      </div>
      <ModeToggle />
    </header>
  )
}
