import { ModeToggle } from './components/mode-toggle'
import { SectionCard } from './components/section-card'

function App() {
  return (
    <div className="min-h-screen bg-[--color-background] text-[--color-foreground]">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img
            src="/src/assets/gero-logo.svg"
            alt="GeroLab Logo"
            className="h-6 w-auto"
          />
          <h1 className="text-2xl">
            <span className="text-gero font-bold">Gero</span>
            <span>Lab</span>
          </h1>
        </div>
        <ModeToggle />
      </header>
      <main className="px-6 pb-6 flex h-[calc(100vh-6rem)] gap-3">
        <SectionCard title="Working memory" className="flex-2">
          Here lies working memory
        </SectionCard>
        <SectionCard title="Registers" className="flex-1">
          Here lies registers
        </SectionCard>
        <SectionCard title="Stack memory" className="flex-2">
          Here lies stack memory
        </SectionCard>
        <SectionCard title="Assembly code" className="flex-auto">
          Here lies dissasembler
        </SectionCard>
      </main>
      <footer className="px-6 pb-4 text-xs text-muted-foreground">
        VM: <span className="text-gero">Gero</span> v0.1 • Console: GRX‑16
      </footer>
    </div>
  )
}

export default App
