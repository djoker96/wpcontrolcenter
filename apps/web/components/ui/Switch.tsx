"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[23px] w-[40px] flex-none cursor-pointer items-center rounded-full border border-[var(--border)] p-[2px] transition-colors duration-150",
        checked ? "bg-[var(--primary)]" : "bg-[var(--border)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-[19px] w-[19px] transform rounded-full bg-white shadow-xs transition-transform duration-150",
          checked ? "translate-x-[17px]" : "translate-x-0"
        )}
      />
    </button>
  );
}
