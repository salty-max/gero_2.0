/// <reference lib="webworker" />
import { expose } from 'comlink'
import { VMService } from './vm.service'

declare global {
  var __GERO__VM_SINGLETON__: VMService | undefined
}

if (!globalThis.__GERO__VM_SINGLETON__) {
  globalThis.__GERO__VM_SINGLETON__ = new VMService()
}

expose(globalThis.__GERO__VM_SINGLETON__!)
