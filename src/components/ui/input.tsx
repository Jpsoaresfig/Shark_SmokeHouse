import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, icon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              {icon}
            </span>
          )}
          <input
            type={type}
            className={cn(
              "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)]",
              "px-3 py-2.5 text-sm text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-muted)]",
              "transition-all duration-200",
              "focus:outline-none focus:border-[var(--color-neon-blue)] focus:bg-[var(--color-bg-hover)] focus:shadow-[0_0_0_3px_var(--color-neon-blue-glow)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-[var(--color-error)] focus:border-[var(--color-error)]",
              icon && "pl-10",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-[var(--color-error)]">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
