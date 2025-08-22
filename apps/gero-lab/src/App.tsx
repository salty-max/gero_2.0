import { Cockpit } from './components/cockpit'
import { Toolbar } from './components/toolbar'
import { useVM } from './hooks/use-vm'

function App() {
  const vm = useVM()

  return (
    <div className="min-h-screen flex flex-col">
      <Toolbar vm={vm} />
      <Cockpit vm={vm} />
      <footer className="px-6 pb-4 text-xs text-muted-foreground">
        VM: <span className="text-gero">Gero</span> v0.1 • Console: GRX‑16
      </footer>
    </div>
  )
}

export default App
