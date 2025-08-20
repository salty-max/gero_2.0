const SCR = $8000
start:
	mov $FF00, &[!SCR]
	mov $0100, &[!SCR]
	mov $0048, &[!SCR]
	mov $0065, &[!SCR + $0001]
	mov $006C, &[!SCR + $0002]
	mov $006C, &[!SCR + $0003]
	mov $006F, &[!SCR + $0004]
	mov $0020, &[!SCR + $0005]
	mov $0057, &[!SCR + $0006]
	mov $006F, &[!SCR + $0007]
	mov $0072, &[!SCR + $0008]
	mov $006C, &[!SCR + $0009]
	mov $0064, &[!SCR + $000A]
	mov $0021, &[!SCR + $000B]
	mov $0200, &[!SCR]
end:
	hlt
