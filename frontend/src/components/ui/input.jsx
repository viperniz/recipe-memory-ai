import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef(
  ({ className, type, error, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    return (
      <input
        type={type}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={ariaDescribedBy}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 transition-all",
          "border-zinc-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
