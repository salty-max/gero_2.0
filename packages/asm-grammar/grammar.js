/**
 * @file Parser for the Gero VM assembly language
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'gero_asm',

  // Only spaces/tabs + comments are extras. NEWLINES are significant.
  extras: ($) => [/[ \t]+/, $.comment],

  // Make "words" be identifiers for editor motions.
  word: ($) => $.identifier,

  rules: {
    // File = lines + optional trailing unterminated line
    source_file: ($) =>
      seq(
        repeat($._line),
        optional(seq(optional($._statement), optional($.comment)))
      ),

    // One physical line: [statement] [comment] NEWLINE
    _line: ($) => seq(optional($._statement), optional($.comment), $.newline),

    // CRLF or LF
    newline: (_) => /[\r]?\n/,

    // Statements
    _statement: ($) => choice($.label, $.directive, $.instruction),

    // Comments: semicolon to end-of-line (do NOT eat the newline)
    comment: (_) => token(seq(';', /[^\n\r]*/)),

    // Identifiers
    identifier: (_) => token(prec(-1, /[A-Za-z_][A-Za-z0-9_]*/)),

    // Labels like: start:
    label: ($) => seq(field('name', $.identifier), ':'),

    // ------------------------------------------------------------
    // Directives (e.g. "const INPUT = $2620", "data8 hasFrameEnded = { $00 }")
    // Optional leading '+' export marker.
    // ------------------------------------------------------------
    directive: ($) =>
      seq(
        field('export', optional($.export_marker)),
        field('keyword', $.directive_keyword),
        repeat($._dir_tail)
      ),

    export_marker: (_) => '+',

    directive_keyword: (_) =>
      token(choice('const', 'data8', 'data16', 'struct')),

    _dir_tail: ($) =>
      choice(
        $.identifier,
        $.variable,
        $.hex_number,
        $.address,
        $.addr_bracket,
        '{',
        '}',
        ',',
        '=',
        ':',
        $.operator
      ),

    // ------------------------------------------------------------
    // Instructions: ISA-restricted mnemonic + optional operands
    // ------------------------------------------------------------
    instruction: ($) =>
      seq(field('mnemonic', $.mnemonic), optional($.operands)),

    // Only legal mnemonics from the ISA (from your RAW_OPCODES keywords)
    mnemonic: (_) =>
      token(
        choice(
          // moves
          'mov',
          'mov8',
          'lmov',
          'hmov',
          // stack
          'push',
          'pop',
          // ALU
          'add',
          'sub',
          'mul',
          'neg',
          'not',
          'inc',
          'dec',
          'swp',
          'and',
          'or',
          'xor',
          'lsh',
          'rsh',
          // jumps/branches
          'jmp',
          'jeq',
          'jne',
          'jlt',
          'jgt',
          'jle',
          'jge',
          'jz',
          'jnz',
          // calls/ret
          'call',
          'ret',
          // interrupts & misc
          'int',
          'rti',
          'brk',
          'hlt'
        )
      ),

    operands: ($) => seq($._operand, repeat(seq(',', $._operand))),

    _operand: ($) =>
      choice(
        $.register_ptr, // &r1
        $.register, // r1, ip, acu, ...
        $.address, // &ABCD (immediate address literal)
        $.addr_bracket, // &[ ...expr... ]
        $.hex_number, // $FFFF
        $.variable, // !SYMBOL
        $.paren_expr, // ( ... )
        $.cast, // <Type> obj.prop
        $.identifier // plain symbol
      ),

    // ------------------------------------------------------------
    // Tokens / primaries
    // ------------------------------------------------------------
    hex_number: (_) => token(seq('$', /[0-9A-Fa-f]{1,4}/)),
    address: (_) => token(seq('&', /[0-9A-Fa-f]{1,4}/)),

    // Bang-prefixed symbol (no token() because it nests a rule)
    variable: ($) => seq('!', $.identifier),

    // Register names (static list)
    register: (_) =>
      token(
        choice(
          'ip',
          'acu',
          'r1',
          'r2',
          'r3',
          'r4',
          'r5',
          'r6',
          'r7',
          'r8',
          'sp',
          'fp',
          'mb',
          'im'
        )
      ),

    // Pointer to register (e.g., &r1)
    register_ptr: ($) => seq('&', $.register),

    // Simple operators used in expressions
    operator: (_) => token(choice('+', '-', '*')),

    // Parenthesized arithmetic expression (used inside brackets)
    paren_expr: ($) =>
      seq(
        '(',
        repeat(
          choice(
            $.hex_number,
            $.variable,
            $.identifier,
            $.operator,
            $.paren_expr
          )
        ),
        ')'
      ),

    // Address expression: &[ ... ]
    addr_bracket: ($) =>
      seq(
        '&',
        '[',
        repeat(
          choice(
            $.hex_number,
            $.variable,
            $.identifier,
            $.register,
            $.operator,
            $.paren_expr,
            $.cast
          )
        ),
        ']'
      ),

    // Cast inside bracket expressions: <Type> obj.prop
    cast: ($) =>
      seq(
        '<',
        field('type', $.identifier),
        '>',
        field('object', $.identifier),
        '.',
        field('property', $.identifier)
      ),
  },
})
