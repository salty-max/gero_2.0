import { type CSSProperties, useEffect, useRef } from 'react'

import { SCALE_FACTOR, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/lib/constants'
import type { GtxEngine } from '@/lib/engine'
import type { SmoothingCtx } from '@/lib/types'
import { VMService } from '@/lib/vm.service'

export function ScreenCanvas({
  engine,
  cart,
  className,
}: {
  engine: GtxEngine
  cart: string
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sc = ctx as SmoothingCtx

    const applySize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = Math.floor(SCREEN_WIDTH * (SCALE_FACTOR * dpr))
      canvas.height = Math.floor(SCREEN_HEIGHT * (SCALE_FACTOR * dpr))
      canvas.style.width = `${SCREEN_WIDTH * SCALE_FACTOR}px`
      canvas.style.height = `${SCREEN_HEIGHT * SCALE_FACTOR}px`
      sc.imageSmoothingEnabled = false
      sc.mozImageSmoothingEnabled = false
      sc.webkitImageSmoothingEnabled = false
      sc.msImageSmoothingEnabled = false
      engine.resize()
    }

    // initial mount
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.floor(SCREEN_WIDTH * (SCALE_FACTOR * dpr))
    canvas.height = Math.floor(SCREEN_HEIGHT * (SCALE_FACTOR * dpr))
    canvas.style.width = `${SCREEN_WIDTH * SCALE_FACTOR}px`
    canvas.style.height = `${SCREEN_HEIGHT * SCALE_FACTOR}px`
    sc.imageSmoothingEnabled = false
    sc.mozImageSmoothingEnabled = false
    sc.webkitImageSmoothingEnabled = false
    sc.msImageSmoothingEnabled = false
    engine.mount(canvas, new VMService(), cart)

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      engine.tick()
    }

    rafRef.current = requestAnimationFrame(loop)

    const onResize = () => applySize()
    window.addEventListener('resize', onResize)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      engine.unmount()
    }
  }, [engine, cart])

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ imageRendering: 'pixelated' as CSSProperties['imageRendering'] }}
    />
  )
}
