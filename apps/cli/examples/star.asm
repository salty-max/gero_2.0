; Draw a centered rectangle of '*' on the 16x16 screen
; Screen device is mapped at &8000..&80FF (16x16 grid)

const SCREEN = $8000
const WIDTH  = $0010   ; 16 columns
const STAR   = $002A   ; '*'
const SPACE  = $0020   ; ' '

start:
  ; Clear and reset screen, print a space at (0,0)
  mov [$0500 + !SPACE], &[!SCREEN]

  ; Rectangle: 8 cols × 4 rows, centered
  ; Rows: 6..9, Cols: 4..11

  ; row 6
  mov [!STAR], &[!SCREEN + (!WIDTH * $0006) + $0004]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0006) + $0005]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0006) + $0006]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0006) + $0007]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0006) + $0008]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0006) + $0009]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0006) + $000A]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0006) + $000B]

  ; row 7
  mov [!STAR], &[!SCREEN + (!WIDTH * $0007) + $0004]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0007) + $0005]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0007) + $0006]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0007) + $0007]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0007) + $0008]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0007) + $0009]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0007) + $000A]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0007) + $000B]

  ; row 8
  mov [!STAR], &[!SCREEN + (!WIDTH * $0008) + $0004]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0008) + $0005]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0008) + $0006]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0008) + $0007]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0008) + $0008]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0008) + $0009]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0008) + $000A]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0008) + $000B]

  ; row 9
  mov [!STAR], &[!SCREEN + (!WIDTH * $0009) + $0004]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0009) + $0005]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0009) + $0006]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0009) + $0007]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0009) + $0008]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0009) + $0009]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0009) + $000A]
  mov [!STAR], &[!SCREEN + (!WIDTH * $0009) + $000B]

  hlt
