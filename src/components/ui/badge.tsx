import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)]/30",
        secondary:
          "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/30",
        success:
          "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
        warning:
          "bg-amber-500/10 text-amber-400 border border-amber-500/30",
        orange:
          "bg-orange-500/10 text-orange-400 border border-orange-500/30",
        pink:
          "bg-pink-500/10 text-pink-400 border border-pink-500/30",
        purple:
          "bg-purple-500/10 text-purple-400 border border-purple-500/30",
        premium:
          "bg-gradient-to-r from-[var(--color-electric-blue)]/20 to-[var(--color-neon-blue)]/20 text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)]/40",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
