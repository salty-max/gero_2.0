import * as P from 'parsil'
import instructions from './instructions'

const parser = P.many(P.choice([instructions])).chain((nodes) =>
  P.endOfInput.map(() => nodes)
)

export default parser
