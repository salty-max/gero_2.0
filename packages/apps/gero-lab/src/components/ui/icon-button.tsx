import type { LucideIcon } from 'lucide-react'
import { Button, type ButtonProps } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  label: string
  icon: LucideIcon
}

export function IconButton({ label, icon: Icon, ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" title={label} aria-label={label} {...props}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
