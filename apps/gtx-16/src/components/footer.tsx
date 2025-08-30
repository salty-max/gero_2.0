import { HeartIcon } from 'lucide-react'

export function Footer() {
  return (
    <footer className="flex items-center justify-between px-6 py-3 text-xs text-muted-foreground bg-background">
      <span>
        Console: <span className="text-gero">GTX‑16</span> • 240×112 • 4bpp
      </span>
      <span className="flex gap-1.5 items-center">
        Made with
        <HeartIcon className="h-4 w-4 animate-pulse inline-block text-gero" />
        by Jellycat Studios
      </span>
    </footer>
  )
}
