import { Cockpit } from './components/cockpit'
import { Toolbar } from './components/toolbar'
import { VMProvider } from './contexts/vm-context'

function App() {
  return (
    <VMProvider>
      <div className="h-screen grid grid-rows-[68px_auto_32px] gap-0">
        <Toolbar />
        <Cockpit />
        <footer className="px-6 pb-4 text-xs text-muted-foreground">
          VM: <span className="text-gero">Gero</span> v0.1 • Console: GRX‑16
        </footer>
      </div>
    </VMProvider>
  )
}

export default App
