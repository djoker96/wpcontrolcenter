"use client";

import { cn } from "@/lib/utils";

export type DotTone = "success" | "warning" | "danger" | "neutral";

interface StatusDotProps {
  tone: DotTone;
  size?: number;
  className?: string;
}

const dotColors: Record<DotTone, string> = {
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  neutral: "bg-[var(--muted-foreground)]",
};

export function StatusDot({ tone, size = 9, className }: StatusDotProps) {
  return (
    <span
      className={cn("inline-block flex-none rounded-full", dotColors[tone], className)}
      style={{ width: size, height: size }}
    />
  );
}
