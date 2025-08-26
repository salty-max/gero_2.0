# Disasm-Style Assembler Usage

The `asm` package **always returns a result** with both the assembled output AND diagnostics, continuing to process even when errors occur.

## Basic Usage

```typescript
import { assembleResult, AssembleErrorCode, isAssembleError } from '@gero/asm'

const source = `
const SCREEN_BASE = $8000

start:
  mov !SCREEN_BASE, r1
  mov $0048, &r1    ; Write 'H' to screen
  hlt
`

const result = assembleResult(source)

// Always returns a result - check diagnostics for errors
console.log('Bytes:', result.bytes)
console.log('Symbols:', result.symbols)
console.log('Errors:', result.diags.errors)

if (result.diags.errors.length === 0) {
  console.log('Assembly successful!')
} else {
  console.log(`Assembly completed with ${result.diags.errors.length} error(s):`)

  // Handle each error
  for (const error of result.diags.errors) {
    console.log(`Error: ${error.code} - ${error.message}`)

    switch (error.code) {
      case AssembleErrorCode.Parse:
        console.log('  → Syntax error in assembly code')
        break
      case AssembleErrorCode.UnresolvedLabel:
        console.log('  → Referenced label not found')
        break
      case AssembleErrorCode.LabelExists:
        console.log('  → Duplicate label definition')
        break
      // ... handle other error types
    }
  }
}
```

## Available Error Types

The Result-based assembler can return the following error types:

- `Parse` - Syntax errors in the assembly code
- `LabelExists` - Duplicate label definitions
- `ConstExists` - Duplicate constant definitions
- `StructExists` - Duplicate struct definitions
- `TableExists` - Duplicate data table definitions
- `UnresolvedLabel` - Reference to undefined label/variable
- `UnresolvedStruct` - Reference to undefined struct
- `UnresolvedProperty` - Reference to undefined struct member
- `UnresolvedSymbol` - Reference to undefined symbol
- `UnsupportedNode` - Unsupported AST node or operation

## Error Recovery and Continuation

Unlike traditional assemblers that stop at the first error, this assembler:

- **Continues processing** even when errors occur
- **Collects all errors** in diagnostics
- **Produces fallback output** (zeros for unresolved symbols, skips invalid instructions)
- **Enables better IDE experience** with comprehensive error reporting

```typescript
const problematicSource = `
const MY_VAL = $00FF
const MY_VAL = $0042      ; Duplicate constant

start:
  mov !UNKNOWN_LABEL, r1  ; Unresolved label
  mov !MY_VAL, r2         ; This will work
  start:                  ; Duplicate label
  hlt
`

const result = assembleResult(problematicSource)

console.log('Collected errors:', result.diags.errors.length) // 3 errors
console.log('Still produced bytes:', result.bytes.length) // > 0 bytes
console.log('Valid symbols found:', result.symbols) // MY_VAL defined
```

## LSP Integration Example

```typescript
import { assembleResult } from '@gero/asm'

export function validateAssembly(source: string) {
  const result = assembleResult(source)

  return {
    // Convert assembler diagnostics to LSP diagnostics
    diagnostics: result.diags.errors.map((error) => ({
      severity: 'error',
      message: error.message,
      code: error.code,
      location: error.location,
    })),
    symbols: result.symbols,
    bytes: result.bytes,
    hasErrors: result.diags.errors.length > 0,
  }
}
```

## Comparison with Legacy API

### Legacy (fails fast, throws exceptions):

```typescript
import { assemble } from '@gero/asm'

try {
  const result = assemble(source, { onError: 'throw' })
  // Only get here if assembly is completely successful
  console.log('Success:', result.bytes, result.symbols)
} catch (error) {
  // Stops at first error, no partial results
  console.log('Failed:', error.message)
}
```

### Disasm-style (collects all errors, continues processing):

```typescript
import { assembleResult } from '@gero/asm'

const result = assembleResult(source)
// Always get a result with bytes, symbols, AND diagnostics
console.log('Bytes:', result.bytes) // Always present
console.log('Symbols:', result.symbols) // Always present
console.log('Errors:', result.diags.errors) // May be empty

if (result.diags.errors.length === 0) {
  console.log('Perfect assembly!')
} else {
  console.log('Assembly with errors, but still usable')
}
```

## Key Benefits

1. **Better IDE/LSP Experience**: Show all errors at once, not just the first one
2. **Partial Results**: Get valid symbols and bytes even when some parts fail
3. **Error Recovery**: Continue processing after errors for comprehensive analysis
4. **Consistent with Disasm**: Same error handling pattern across the codebase
5. **Rich Diagnostics**: Structured error information perfect for language servers

This approach is particularly valuable for language servers, IDEs, and development tools that need to provide comprehensive error reporting and continue functioning even with invalid code.
