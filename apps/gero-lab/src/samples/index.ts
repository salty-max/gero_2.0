export type Sample = { id: string; name: string; code: string }

import hello from './hello.gasm?raw'
import loop from './loop.gasm?raw'
import stackDemo from './stack_demo.gasm?raw'

export const SAMPLES: Sample[] = [
  { id: 'hello', name: 'Hello (arith + halt)', code: hello },
  { id: 'loop', name: 'Loop (inc memory)', code: loop },
  { id: 'stack', name: 'Stack demo (call/ret)', code: stackDemo },
]
