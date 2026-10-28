import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "default" | "secondary" | "accent" | "success" | "warning" | "destructive" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-fg)] text-[var(--color-bg)]",
  secondary: "bg-[var(--color-border)] text-[var(--color-fg-muted)]",
  accent: "bg-[var(--color-accent)] text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-black",
  destructive: "bg-red-600 text-white",
  outline: "border border-[var(--color-border)] text-[var(--color-fg-muted)]",
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        "text-xs font-semibold tracking-wide uppercase",
        "px-2 py-0.5 rounded-sm",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
