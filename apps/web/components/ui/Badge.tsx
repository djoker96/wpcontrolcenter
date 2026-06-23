"use client";

import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "primary";

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

const toneStyles: Record<BadgeTone, string> = {
  success:
    "bg-[color-mix(in_oklch,var(--success)_14%,white)] text-[var(--success)] border-[color-mix(in_oklch,var(--success)_35%,white)]",
  warning:
    "bg-[color-mix(in_oklch,var(--warning)_16%,white)] text-[var(--warning-foreground)] border-[color-mix(in_oklch,var(--warning)_42%,white)]",
  danger:
    "bg-[color-mix(in_oklch,var(--danger)_12%,white)] text-[var(--danger)] border-[color-mix(in_oklch,var(--danger)_32%,white)]",
  neutral:
    "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]",
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]",
};

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[11px] font-medium border",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
