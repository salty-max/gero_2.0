import parser from './parser'
import { deepLog } from './parser/util/deep-log'

const program = [
  'mov $4200, r1 ',
  'mov r1, &0060',
  'mov $1300, r1',
  'mov &0060, r2',
  'add r1, r2',
  'hlt',
].join('\n')

const out = parser.run(program)

if (out.isError) {
  throw new Error(out.error)
}

deepLog(out.result, {
  maxDepth: Infinity,
})

const code = []
