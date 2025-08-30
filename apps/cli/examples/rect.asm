; Draw a centered rectangle of '*' on the 16x16 screen using subroutines
; Screen device is mapped at &8000..&80FF (16x16 grid)

const SCREEN = $8000
const WIDTH  = $0010   ; 16 columns
const STAR   = $002A   ; '*'
const SPACE  = $0020   ; ' '

; Subroutine: draw_run
; Writes rN cells of value r2 starting at [r1], advancing r1 by 1 each time.
; Clobbers: acu
draw_run:
  mov r2, &r1            ; store [r1] = r2 (16-bit)
  inc r1                 ; advance to next cell
  dec r3                 ; count down
  mov $0000, acu         ; ACC = 0 for comparison
  jgt r3, &[!draw_run]   ; if r3 (count) > 0, continue
  ret

start:
  ; Clear and reset screen, print a space at (0,0)
  mov [$0500 + !SPACE], &[!SCREEN]

  ; Rectangle: 8 cols × 4 rows, centered at rows 6..9, cols 4..11

  ; Compute base for row 6: SCREEN + WIDTH*6 + 4 (using top-level [] expr)
  mov [!SCREEN + (!WIDTH * $0006) + $0004], r1
  mov r1, r5             ; save base for current row in r5

  ; Row 6 (top border): draw full row in RED
  mov $042A, r2          ; RED + '*'
  mov $0008, r3
  push $0000
  call &[!draw_run]

  ; Row 7 (middle): fill BLUE then paint left/right edges RED
  ; base = previous base + WIDTH
  mov r5, r1
  add !WIDTH, r1
  mov acu, r1
  mov r1, r5             ; update saved base
  ; fill in BLUE
  mov $032A, r2          ; BLUE + '*'
  mov $0008, r3
  push $0000
  call &[!draw_run]
  ; left edge RED at base r5
  mov r5, r1
  mov $042A, r2
  mov $0001, r3
  push $0000
  call &[!draw_run]
  ; right edge RED at base r5 + 7
  mov r5, r1
  add $0007, r1
  mov acu, r1
  mov $0001, r3
  push $0000
  call &[!draw_run]

  ; Row 8 (middle): repeat blue fill + red edges
  mov r5, r1
  add !WIDTH, r1
  mov acu, r1
  mov r1, r5
  ; fill BLUE
  mov $032A, r2
  mov $0008, r3
  push $0000
  call &[!draw_run]
  ; left RED
  mov r5, r1
  mov $042A, r2
  mov $0001, r3
  push $0000
  call &[!draw_run]
  ; right RED
  mov r5, r1
  add $0007, r1
  mov acu, r1
  mov $0001, r3
  push $0000
  call &[!draw_run]

  ; Row 9 (bottom border): draw full row RED
  mov r5, r1
  add !WIDTH, r1
  mov acu, r1
  mov $042A, r2
  mov $0008, r3
  push $0000
  call &[!draw_run]

  hlt
