#!/usr/bin/env node
import { assemble } from './dist/index.js'

// Example assembly code with intentional errors
const problematicCode = `
const MY_VAL = $00FF
const MY_VAL = $0042      ; Duplicate constant - ERROR 1

start:
  mov !MY_VAL, r1         ; This will work fine
  mov !UNKNOWN_LABEL, r2  ; Unresolved label - ERROR 2
  add $10, r1
  start:                  ; Duplicate label - ERROR 3
  hlt
`

console.log('🔧 Assembling code with intentional errors...\n')

const result = assemble(problematicCode)

console.log('📊 RESULTS:')
console.log(`   Bytes produced: ${result.bytes.length}`)
console.log(`   Symbols found: ${Object.keys(result.symbols).length}`)
console.log(`   Errors collected: ${result.diags.errors.length}`)

console.log('\n🏷️  SYMBOLS:')
for (const [name, addr] of Object.entries(result.symbols)) {
  console.log(`   ${name}: 0x${addr.toString(16).padStart(4, '0')}`)
}

console.log('\n💾 BYTES:')
console.log(
  `   [${result.bytes.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`
)

console.log('\n❌ ERRORS:')
if (result.diags.errors.length === 0) {
  console.log('   No errors! ✨')
} else {
  result.diags.errors.forEach((error, i) => {
    console.log(`   ${i + 1}. ${error.code}: ${error.message}`)
  })
}

console.log('\n🎉 Notice how the assembler:')
console.log('   - Continued processing despite errors')
console.log('   - Collected ALL errors (not just the first one)')
console.log('   - Still produced usable output with fallback values')
console.log('   - Found valid symbols even when some definitions failed')

// Demonstrate comparison with perfect code
console.log('\n' + '='.repeat(50))
console.log('📝 Now assembling perfect code for comparison...\n')

const perfectCode = `
const SCREEN_ADDR = $8000

data16 myRect = { $08, $08, $10, $10 }

struct Rectangle {
  x: $00,
  y: $02,
  width: $04,
  height: $06,
}

main:
  mov !SCREEN_ADDR, r1
  mov [<Rectangle> myRect.x], r2 ; Load x from struct
  mov $0048, &r1    ; Write 'H' to screen position
  hlt
`

const perfectResult = assemble(perfectCode)
console.log('📊 PERFECT CODE RESULTS:')
console.log(`   Bytes: ${perfectResult.bytes.length}`)
console.log(`   Symbols: ${Object.keys(perfectResult.symbols).length}`)
console.log(`   Errors: ${perfectResult.diags.errors.length} ✨`)
