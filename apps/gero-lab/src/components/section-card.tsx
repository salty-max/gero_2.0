import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'

type SectionCardProps = {
  title: string
  description?: string
  className?: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export function SectionCard({
  title,
  description,
  children,
  actions,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn(className, 'bg-background pt-3 gap-2')}>
      <CardHeader>
        <div className="h-[34px] flex justify-between items-center gap-3">
          <CardTitle className="text-gero">{title}</CardTitle>
          {actions}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="h-full">{children}</CardContent>
    </Card>
  )
}
