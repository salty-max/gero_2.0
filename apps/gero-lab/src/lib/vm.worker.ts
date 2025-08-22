/// <reference lib="webworker" />
import { expose } from 'comlink'
import { VMService } from './vm.service'

expose(new VMService())
