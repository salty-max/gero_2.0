export function Label({
  children,
  ...props
}: React.HTMLAttributes<HTMLLabelElement>) {
  return (
    <label className="opacity-70" {...props}>
      {children}
    </label>
  )
}
