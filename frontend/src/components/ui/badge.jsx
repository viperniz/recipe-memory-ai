import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-purple-500/20 text-purple-400 border border-purple-500/30",
        secondary:
          "bg-zinc-800 text-zinc-300 border border-zinc-700",
        destructive:
          "bg-red-500/20 text-red-400 border border-red-500/30",
        success:
          "bg-green-500/20 text-green-400 border border-green-500/30",
        warning:
          "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        cyan:
          "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
        outline:
          "text-zinc-300 border border-zinc-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
