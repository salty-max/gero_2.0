import { useEffect, useRef } from 'react'
import { Header } from './components/header'
import { Footer } from './components/footer'
import { Card } from './components/ui/card'

const WIDTH = 240
const HEIGHT = 112
const SCALE = 4

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    c.width = WIDTH * dpr
    c.height = HEIGHT * dpr
    c.style.width = `${WIDTH * SCALE}px`
    c.style.height = `${HEIGHT * SCALE}px`
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = '#29ADFF'
    ctx.font = '8px monospace'
    ctx.fillText('GTX-16', 8, 16)
    ctx.fillText('Canvas Ready', 8, 28)
  }, [])

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <Header />
      <main className="flex items-center justify-center p-6">
        <Card
          className={`p-0 w-[${WIDTH * SCALE}px] h-[${WIDTH * SCALE}px] overflow-hidden`}
        >
          <canvas ref={canvasRef} />
        </Card>
      </main>
      <Footer />
    </div>
  )
}
