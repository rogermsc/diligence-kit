import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",

        // Provenance. A figure's basis travels with it onto every surface it
        // appears on, so it needs one definition rather than an inline colour
        // string per component — which is how the current code accumulated
        // roughly forty of them. Mono and squared off, because these label a
        // value transcribed from a document.
        actual:
          "rounded-sm border-transparent bg-evidence-actual-bg font-mono font-medium tracking-tight text-evidence-actual",
        "pro-forma":
          "rounded-sm border-transparent bg-evidence-proforma-bg font-mono font-medium tracking-tight text-evidence-proforma",
        projection:
          "rounded-sm border-transparent bg-evidence-projection-bg font-mono font-medium tracking-tight text-evidence-projection",
        unknown:
          "rounded-sm border-transparent bg-evidence-unknown-bg font-mono font-medium tracking-tight text-evidence-unknown",

        // Disagreement, and its opposite. Conflict is not destructive: two
        // documents stating different numbers is the finding, not a fault.
        conflict:
          "rounded-sm border-transparent bg-conflict-bg font-mono font-medium tracking-tight text-conflict",
        corroborated:
          "rounded-sm border-transparent bg-evidence-actual-bg font-mono font-medium tracking-tight text-corroborated",
        missing:
          "rounded-sm border border-dashed bg-transparent font-mono font-normal text-missing",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants } 