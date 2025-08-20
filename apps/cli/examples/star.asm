; Animate a '*' moving from (0,0) to (15,15) along the diagonal
; Screen device is mapped at &8000..&80FF (16x16 grid)

const SCREEN = $8000
const WIDTH  = $0010   ; 16 columns
const STAR   = $002A   ; '*'
const SPACE  = $0020   ; ' '

; Delay subroutine (busy wait)
delay:
  mov $00FF, r5
delay_loop:
  dec r5
  mov $0000, acc
  jgt r5, &[!delay_loop]
  ret

start:
  ; Clear and reset screen, print a space at (0,0)
  mov [$FF00 + !SPACE], &[!SCREEN]

  ; r1 = current cell pointer (start at 0,0)
  mov !SCREEN, r1
  mov $0010, r3          ; 16 steps

loop:
  ; clear screen each frame to show only the current star
  mov [$FF00 + !SPACE], &[!SCREEN]
  ; draw star
  mov !STAR, &r1
  push $0000
  call &[!delay]
  ; advance to next diagonal cell: addr += WIDTH+1 (0x0011)
  add $0011, r1
  mov acc, r1
  ; step count
  dec r3
  mov $0000, acc
  jgt r3, &[!loop]
  hlt
