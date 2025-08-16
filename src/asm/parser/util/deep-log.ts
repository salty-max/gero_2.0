type DeepLogOptions = {
  maxDepth?: number // stop expanding after this depth
  maxArrayItems?: number // how many array items to show per level
  maxProps?: number // how many object props to show per level
  sortKeys?: boolean // sort object keys alphabetically
  showUndefined?: boolean // include keys with undefined values
  color?: boolean // ANSI colors in node headers
  labelKeys?: string[] // keys used to label AST nodes in the header
}

const DEFAULTS: Required<DeepLogOptions> = {
  maxDepth: 6,
  maxArrayItems: 50,
  maxProps: 50,
  sortKeys: true,
  showUndefined: false,
  color: true,
  labelKeys: ['type', 'kind'],
}

const c = {
  dim: (s: string, on: boolean) => (on ? `\x1b[2m${s}\x1b[0m` : s),
  cyan: (s: string, on: boolean) => (on ? `\x1b[36m${s}\x1b[0m` : s),
  yellow: (s: string, on: boolean) => (on ? `\x1b[33m${s}\x1b[0m` : s),
}

export function deepLog(
  value: unknown,
  options: DeepLogOptions = {},
  title?: string
) {
  const opt = { ...DEFAULTS, ...options }
  const seen = new WeakSet<object>()
  const out: string[] = []

  if (title) out.push(title)

  const push = (line = '') => out.push(line)

  const indent = (n: number) => '  '.repeat(n)

  const labelOf = (v: any) => {
    if (!v || typeof v !== 'object') return ''
    for (const k of opt.labelKeys) {
      if (k in v && typeof v[k] === 'string') return String(v[k])
    }
    return ''
  }

  const fmtScalar = (v: any): string => {
    switch (typeof v) {
      case 'string':
        return JSON.stringify(v)
      case 'number':
        return String(v)
      case 'bigint':
        return `${v}n`
      case 'boolean':
        return String(v)
      case 'undefined':
        return 'undefined'
      case 'function':
        return `[Function ${v.name || 'anonymous'}]`
      case 'symbol':
        return v.toString()
      default:
        if (v === null) return 'null'
        if (v instanceof Date)
          return `Date(${isNaN(+v) ? 'Invalid' : v.toISOString()})`
        if (v instanceof RegExp) return v.toString()
        return ''
    }
  }

  const format = (v: any, depth: number, key?: string) => {
    // Scalars & special objects short‑circuit
    const scalar = fmtScalar(v)
    if (scalar) return push(`${indent(depth)}${key ? key + ': ' : ''}${scalar}`)

    // Circulars
    if (typeof v === 'object') {
      if (seen.has(v)) {
        return push(
          `${indent(depth)}${key ? key + ': ' : ''}${c.dim('[Circular]', opt.color)}`
        )
      }
      seen.add(v)
    }

    // Arrays
    if (Array.isArray(v)) {
      const header = `${key ? key + ': ' : ''}[${v.length}]`
      push(`${indent(depth)}${c.dim(header, opt.color)}`)
      const len = Math.min(v.length, opt.maxArrayItems)
      for (let i = 0; i < len; i++) {
        if (depth >= opt.maxDepth) {
          push(`${indent(depth + 1)}…`)
          break
        }
        format(v[i], depth + 1, `[${i}]`)
      }
      if (v.length > len) {
        push(`${indent(depth + 1)}… (${v.length - len} more)`)
      }
      return
    }

    // Plain objects
    const nodeLabel = labelOf(v)
    const headerName = nodeLabel
      ? `${key ? key + ': ' : ''}${c.cyan(nodeLabel, opt.color)} ${c.dim('{…}', opt.color)}`
      : `${key ? key + ': ' : ''}{}`

    push(`${indent(depth)}${headerName}`)

    if (depth >= opt.maxDepth) {
      push(`${indent(depth + 1)}…`)
      return
    }

    let entries = Object.entries(v as Record<string, unknown>)
    if (!opt.showUndefined)
      entries = entries.filter(([, val]) => val !== undefined)
    if (opt.sortKeys) entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

    const total = entries.length
    entries = entries.slice(0, opt.maxProps)

    for (const [k, val] of entries) {
      // Compact line if scalar
      const sc = fmtScalar(val as any)
      if (sc) {
        push(`${indent(depth + 1)}${c.yellow(k, opt.color)}: ${sc}`)
        continue
      }
      // Recurse
      format(val, depth + 1, c.yellow(k, opt.color))
    }

    if (total > entries.length) {
      push(`${indent(depth + 1)}… (${total - entries.length} more)`)
    }
  }

  format(value, 0)
  // One print so logs don’t interleave in CI
  console.log(out.join('\n'))
}
