import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { TvIcon } from 'lucide-react'

const STORAGE_KEY = 'gero:crt:v1'

export function CRTToggle() {
  const [on, setOn] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      return v === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (on) root.classList.add('crt')
    else root.classList.remove('crt')
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
    } catch {
      // ignore
    }
  }, [on])

  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={on}
      title={on ? 'Disable CRT effect' : 'Enable CRT effect'}
      onClick={() => setOn((v) => !v)}
    >
      <TvIcon className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Toggle CRT</span>
    </Button>
  )
}
