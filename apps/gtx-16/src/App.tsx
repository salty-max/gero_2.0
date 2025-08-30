import { Header } from './components/header'
import { Footer } from './components/footer'
import { Card } from './components/ui/card'
import { ScreenCanvas } from './components/screen-canvas'
import { GtxEngine } from './lib/engine'
import { SCREEN_WIDTH, SCREEN_HEIGHT, SCALE_FACTOR } from './lib/constants'

import frogger from './frogger.gtx?raw'

export default function App() {
  const engine = new GtxEngine()
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <Header />
      <main className="flex items-center justify-center p-6">
        <Card
          className="p-0 overflow-hidden"
          style={{
            width: SCREEN_WIDTH * SCALE_FACTOR,
            height: SCREEN_HEIGHT * SCALE_FACTOR,
          }}
        >
          <ScreenCanvas engine={engine} cart={frogger} />
        </Card>
      </main>
      <Footer />
    </div>
  )
}
