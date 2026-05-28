import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] hover:bg-[var(--color-neon-cyan)] shadow-[var(--shadow-neon-sm)] hover:shadow-[var(--shadow-neon-md)] hover:-translate-y-0.5",
        outline:
          "border border-[var(--color-neon-blue)] text-[var(--color-neon-blue)] bg-transparent hover:bg-[var(--color-neon-blue-glow)] hover:shadow-[var(--shadow-neon-sm)]",
        ghost:
          "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
        destructive:
          "bg-[var(--color-error)] text-white hover:bg-red-600 hover:shadow-[0_0_12px_rgba(255,51,68,0.4)]",
        secondary:
          "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-[var(--color-neon-blue)] hover:text-[var(--color-neon-blue)]",
        link: "text-[var(--color-neon-blue)] underline-offset-4 hover:underline p-0 h-auto",
        premium:
          "bg-gradient-to-r from-[var(--color-electric-blue)] to-[var(--color-neon-blue)] text-white hover:shadow-[var(--shadow-neon-md)] hover:-translate-y-0.5",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
