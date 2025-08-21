import type { RegName } from '@gero/vm'

export type DebugInfo = {
  symbols: Record<string, { addr: number; size?: number }>
  lineMap: Array<{
    addr: number
    len: number
    file: string
    line: number
    col?: number
  }>
  comments?: Record<number, string>
}

export type RegisterFile = { [K in RegName]: number }

export type Snapshot = {
  regs: RegisterFile
  ip: RegisterFile['ip']
  sp: RegisterFile['sp']
  fp: RegisterFile['fp']
}

export type Cmd =
  | { t: 'init'; memorySize: number; ivAddr?: number }
  | { t: 'load'; bytes: Uint8Array; start: number; debug?: DebugInfo }
  | { t: 'reset' }
  | { t: 'run' }
  | { t: 'pause' }
  | { t: 'step'; count?: number }
  | { t: 'breakpoints'; addrs: number[] }
  | { t: 'peek'; addr: number; len: number; reqId?: number }
  | { t: 'poke'; addr: number; data: Uint8Array }
  | { t: 'setReg'; reg: RegName; value: number }

export type Ev =
  | { t: 'ready' }
  | {
      t: 'paused'
      reason: 'breakpoint' | 'manual' | 'fault' | 'halt'
      ip: number
      fault?: Fault
    }
  | { t: 'tick'; ip: number }
  | { t: 'snapshot'; snap: Snapshot }
  | { t: 'mem'; addr: number; data: Uint8Array; reqId?: number }
  | { t: 'trace'; ip: number; before: Snapshot; after: Snapshot }

export type Fault = {
  msg: string
  code?: string
  meta?: Record<string, unknown>
}
