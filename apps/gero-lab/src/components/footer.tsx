import { HeartIcon } from 'lucide-react'

export function Footer() {
  return (
    <footer className="flex items-center justify-between px-6 py-3 text-xs text-muted-foreground bg-background">
      <span>
        VM: <span className="text-gero">Gero</span> v0.1
      </span>
      <span>
        Made with{' '}
        <HeartIcon className="h-4 w-4 animate-pulse inline-block text-gero" />{' '}
        by Jellycat Studios
      </span>
    </footer>
  )
}
