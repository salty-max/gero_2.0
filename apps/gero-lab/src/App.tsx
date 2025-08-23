import { Cockpit } from './components/cockpit'
import { Toolbar } from './components/toolbar'
import { useVM } from './hooks/use-vm'

function App() {
  const vm = useVM()

  return (
    <div className="h-screen grid grid-rows-[68px_auto_32px] gap-0">
      <Toolbar vm={vm} />
      <Cockpit vm={vm} />
      <footer className="px-6 pb-4 text-xs text-muted-foreground">
        VM: <span className="text-gero">Gero</span> v0.1 • Console: GRX‑16
      </footer>
    </div>
  )
}

export default App
