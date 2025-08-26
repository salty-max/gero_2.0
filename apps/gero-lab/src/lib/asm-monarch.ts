import * as monaco from 'monaco-editor'

export type IsaInfo = {
  mnemonics: readonly string[]
  registers: readonly string[]
}

export function registerAsmMonarch(langId: string, isa: IsaInfo): void {
  const mnems = uniqLower(isa.mnemonics).sort(byLengthDesc).join('|')
  const regs = uniqLower(isa.registers).sort(byLengthDesc).join('|')

  monaco.languages.setLanguageConfiguration(langId, {
    comments: { lineComment: ';' },
    brackets: [
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  })

  monaco.languages.setMonarchTokensProvider(langId, {
    ignoreCase: true,
    defaultToken: '',

    brackets: [
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
    ],

    tokenizer: {
      root: [
        [/;.*/, 'comment'],
        [/^\s*\+/, 'keyword.export'],
        [/^\s*[A-Za-z_]\w*(?=\s*:)/, 'type.label'],
        [/^\s*(?:data(?:8|16)|const|struct)\b/, 'keyword.directive'],
        // fallback anywhere on the line (handles "+data16" and "+  data16")
        [/\b(?:data(?:8|16)|const|struct)\b/, 'keyword.directive'],
        [new RegExp(String.raw`^\s*(?:${mnems})\b`), 'keyword.mnemonic'],
        [new RegExp(String.raw`\b(?:${mnems})\b`), 'keyword.mnemonic'],
        [new RegExp(String.raw`\b(?:${regs})\b`), 'variable.register'],
        [/\$[0-9A-Fa-f]{1,4}\b/, 'number.hex'],

        // address literal (unchanged)
        [/&[0-9A-Fa-f]{1,4}\b/, 'address.literal'],

        // BOL: ensure & is tokenized if it starts a statement
        [/^\s*&/, 'address.delim'],

        // fallback anywhere
        [/&/, 'address.delim'],

        // '[' will enter the bracket state next, which is exactly what we want
        [/\[/, { token: 'delimiter.square', next: '@bracketExpr' }],
        [/\(/, { token: 'delimiter.parenthesis', next: '@parenExpr' }],
        [/[+\-*]/, 'operator'],
        [/[,:]/, 'delimiter'],
        [/[A-Za-z_]\w*/, 'identifier'],
        [/\s+/, 'white'],
      ],

      // [ ... ] (generic bracket expr)
      bracketExpr: [
        [/$/, { token: '', next: '@pop' }],
        [/\]/, { token: 'delimiter.square', next: '@pop' }],

        // in case we ever start a new line still in this state
        [/^\s*&/, 'address.delim'],
        [/&/, 'address.delim'],

        [/</, { token: 'cast.delim', next: '@castType_br' }],
        [new RegExp(String.raw`\b(?:${mnems})\b`), 'keyword.mnemonic'],
        [new RegExp(String.raw`\b(?:${regs})\b`), 'variable.register'],
        [/\$[0-9A-Fa-f]{1,4}\b/, 'number.hex'],
        [/[A-Za-z_]\w*/, 'identifier'],
        [/[+\-*]/, 'operator'],
        [/\(/, { token: 'delimiter.parenthesis', next: '@parenExpr' }],
        [/\s+/, 'white'],
      ],

      // ( ... )
      parenExpr: [
        [/\)/, { token: 'delimiter.parenthesis', next: '@pop' }],
        [new RegExp(String.raw`\b(?:${regs})\b`), 'variable.register'],
        [/\$[0-9A-Fa-f]{1,4}\b/, 'number.hex'],
        [/[A-Za-z_]\w*/, 'identifier'],
        [/[+\-*]/, 'operator'],
        [/\s+/, 'white'],
      ],

      castType_br: [
        [/[A-Za-z_]\w*/, 'cast.type'],
        [/>/, { token: 'cast.delim', next: '@castObj_br' }],
        [/\s+/, 'white'],
        [/./, { token: '@rematch', next: '@bracketExpr' }],
      ],
      castObj_br: [
        [/\s+/, 'white'],
        [/[A-Za-z_]\w*/, { token: 'identifier', next: '@castDot_br' }],
        [/./, { token: '@rematch', next: '@bracketExpr' }],
      ],
      castDot_br: [
        [/\./, 'delimiter'],
        [/[A-Za-z_]\w*/, { token: 'property', next: '@bracketExpr' }],
        [/\s+/, 'white'],
        [/./, { token: '@rematch', next: '@bracketExpr' }],
      ],
      // -----------------------------------------------------------
    },
  })

  monaco.editor.defineTheme('gero-mocha', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', background: '0E0E0E', foreground: 'CDD6F4' }, // base text
      { token: 'comment', foreground: '6C7086', fontStyle: 'italic' },
      { token: 'keyword.directive', foreground: 'F5C2E7', fontStyle: 'bold' },
      { token: 'keyword.export', foreground: 'F38BA8', fontStyle: 'bold' },
      { token: 'keyword.mnemonic', foreground: '89B4FA', fontStyle: 'bold' },
      { token: 'variable.register', foreground: '94E2D5', fontStyle: 'bold' },
      { token: 'number.hex', foreground: 'FAB387' },
      { token: 'address.literal', foreground: 'F9E2AF' },
      { token: 'address.delim', foreground: 'CBA6F7' },
      { token: 'cast.type', foreground: 'A6E3A1', fontStyle: 'bold' },
      { token: 'cast.delim', foreground: 'CBA6F7' },
      { token: 'property', foreground: 'F2CDCD' },
      { token: 'type.label', foreground: 'F5E0DC', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'CDD6F4' },
      { token: 'operator', foreground: 'F5C2E7' },
      { token: 'delimiter', foreground: '89DCEB' },
    ],
    colors: {
      'editor.background': '#0A0A0A',
      'editor.foreground': '#CDD6F4',
      'editor.lineHighlightBackground': '#1E1E2E',
      'editorCursor.foreground': '#F38BA8',
      'editorLineNumber.foreground': '#6C7086',
      'editorLineNumber.activeForeground': '#BAC2DE',
      'editor.selectionBackground': '#45475A',
      'editor.inactiveSelectionBackground': '#313244',
    },
  })

  monaco.editor.defineTheme('gero-lab', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'E6E6E6', background: '0E0E0E' }, // default text
      { token: 'comment', foreground: '555555', fontStyle: 'italic' },
      { token: 'keyword.directive', foreground: 'FF5555', fontStyle: 'bold' }, // matches UI red
      { token: 'keyword.export', foreground: 'FF5555', fontStyle: 'bold' },
      { token: 'keyword.mnemonic', foreground: 'FF7B72', fontStyle: 'bold' }, // softer red/orange for opcodes
      { token: 'variable.register', foreground: '5DE6D1', fontStyle: 'bold' }, // teal
      { token: 'number.hex', foreground: 'FFD966' }, // amber/yellow for numbers
      { token: 'address.literal', foreground: 'FFA07A' }, // light salmon
      { token: 'address.delim', foreground: 'C678DD' }, // purple for &
      { token: 'cast.type', foreground: '98C379', fontStyle: 'bold' }, // green for struct names
      { token: 'cast.delim', foreground: 'C678DD' }, // purple <>
      { token: 'property', foreground: 'E6E6E6' }, // keep neutral
      { token: 'type.label', foreground: 'FF5555', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'E6E6E6' },
      { token: 'operator', foreground: 'FF7B72' },
      { token: 'delimiter', foreground: 'AAAAAA' },
    ],
    colors: {
      'editor.background': '#0E0E0E', // pure black, same as UI
      'editor.foreground': '#E6E6E6',
      'editor.lineHighlightBackground': '#161616',
      'editorCursor.foreground': '#FF5555', // red cursor
      'editorLineNumber.foreground': '#555555',
      'editorLineNumber.activeForeground': '#E6E6E6',
      'editor.selectionBackground': '#222222',
      'editor.inactiveSelectionBackground': '#1A1A1A',
    },
  })
}

function uniqLower(xs: readonly string[]): string[] {
  const s = new Set(xs.map((x) => x.toLowerCase()))
  return [...s]
}
function byLengthDesc(a: string, b: string): number {
  return b.length - a.length
}
