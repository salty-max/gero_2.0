import { Cockpit } from './components/cockpit'
import { Header } from './components/header'
import { VMProvider } from './contexts/vm-context'
import { ProgramProvider } from './contexts/program-context'
import { Toaster } from './components/ui/sonner'

function App() {
  return (
    <VMProvider>
      <ProgramProvider>
        <div className="h-screen grid grid-rows-[68px_auto_40px] gap-0">
          <Header />
          <Cockpit />
          <footer className="px-6 py-3 text-xs text-muted-foreground bg-background">
            VM: <span className="text-gero">Gero</span> v0.1 • Console: GRX‑16
          </footer>
        </div>
      </ProgramProvider>
      <Toaster />
    </VMProvider>
  )
}

export default App
