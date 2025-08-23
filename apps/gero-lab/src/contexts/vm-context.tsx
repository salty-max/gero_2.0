import { createContext, useContext, type PropsWithChildren } from 'react'
import { useVMService } from '@/hooks/use-vm'

export type VMApi = ReturnType<typeof useVMService>

const VMContext = createContext<VMApi | null>(null)

export type VMProviderProps = PropsWithChildren<
  Partial<Parameters<typeof useVMService>[0]>
>

export function VMProvider({ children, ...opts }: VMProviderProps) {
  const vm = useVMService(opts)
  return <VMContext.Provider value={vm}>{children}</VMContext.Provider>
}

export function useVM(): VMApi {
  const ctx = useContext(VMContext)
  if (!ctx) throw new Error('useVM must be used within <VMProvider>')
  return ctx
}
