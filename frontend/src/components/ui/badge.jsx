import * as React from "react"
import { cn } from "../../lib/utils"

const variantClasses = {
  default: "badge-default",
  secondary: "badge-secondary",
  destructive: "badge-destructive",
  success: "badge-success",
  warning: "badge-warning",
  cyan: "badge-cyan",
  outline: "badge-outline",
}

function Badge({ className, variant = "default", ...props }) {
  return (
    <div
      className={cn("badge-base", variantClasses[variant] || variantClasses.default, className)}
      {...props}
    />
  )
}

export { Badge }
