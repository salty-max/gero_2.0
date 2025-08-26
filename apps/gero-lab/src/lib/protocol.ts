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

export const PROTOCOL_VERSION = 1
export type BaseMsg = { v: typeof PROTOCOL_VERSION }

type CmdDef =
  | { t: 'init'; memorySize: number; ivAddr?: number }
  | { t: 'load'; bytes: Uint8Array; start: number; debug?: DebugInfo }
  | { t: 'reset' }
  | { t: 'run'; ip: number }
  | { t: 'pause' }
  | { t: 'step'; count?: number }
  | { t: 'breakpoints'; addrs: number[] }
  | { t: 'ping'; id?: number }
  | { t: 'peek'; addr: number; len: number; reqId?: number }
  | { t: 'poke'; addr: number; data: Uint8Array }
  | { t: 'setReg'; reg: RegName; value: number }
export type Cmd = BaseMsg & CmdDef

export type EvDef =
  | { t: 'ready' }
  | { t: 'pong'; id?: number }
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
  | { t: 'irq'; phase: 'enter' | 'exit'; ip: number }
  | { t: 'im'; from: number; to: number }
  | { t: 'run'; ip: number }
  | { t: 'load'; start: number; size: number; entry: number }
  | { t: 'bp'; add: number[]; remove: number[]; total: number }
export type Ev = BaseMsg & EvDef

export type Fault = {
  msg: string
  code?: string
  meta?: Record<string, unknown>
}
