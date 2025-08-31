; -------- Comments --------
(comment) @comment

; -------- Labels --------
(label (identifier) @label)

; -------- Directives --------
(directive keyword: (directive_keyword) @keyword)
(directive export: (export_marker) @attribute)

; -------- Instructions / mnemonics --------
(mnemonic) @keyword

; -------- Registers & register pointers --------
(register) @variable.builtin
(register_ptr "&" @operator)
(register_ptr (register) @variable.builtin)

; -------- Literals --------
(hex_number) @number
(address) @number

; -------- Address bracket expressions (&[ ... ]) --------
(addr_bracket "&" @operator)
(addr_bracket "[" @punctuation.bracket)
(addr_bracket "]" @punctuation.bracket)

; -------- Variables (!IDENT) --------
(variable "!" @operator)
(variable (identifier) @constant)

; -------- Operators --------
(operator) @operator

; -------- Casts (<Type> obj.prop) --------
(cast "<" @punctuation.special)
(cast ">" @punctuation.special)
(cast "." @punctuation.delimiter)
(cast type: (identifier) @type)
(cast object: (identifier) @variable)
(cast property: (identifier) @property)

; -------- Fallbacks (keep last, minimal) --------
; Don’t over-highlight everything as variable; prefer plain identifier.
; Uncomment if you want a very light fallback:
; (identifier) @variable
