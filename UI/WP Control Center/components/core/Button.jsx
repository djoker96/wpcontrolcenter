import React from "react";

const SIZES = {
  sm: { height: "var(--control-h-sm)", padding: "0 12px", font: "var(--text-sm)" },
  md: { height: "var(--control-h)", padding: "0 16px", font: "var(--text-base)" },
  lg: { height: "var(--control-h-lg)", padding: "0 20px", font: "var(--text-md)" },
};

const VARIANTS = {
  primary: { background: "var(--primary)", color: "var(--primary-foreground)", border: "1px solid var(--primary)" },
  secondary: { background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid var(--border)" },
  outline: { background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--foreground)", border: "1px solid transparent" },
  destructive: { background: "var(--destructive)", color: "var(--danger-foreground)", border: "1px solid var(--destructive)" },
};

/**
 * Button — primary action control. Square corners (--radius:0),
 * amber primary, dark-amber label.
 */
export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  children,
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <button
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        height: s.height,
        padding: s.padding,
        fontFamily: "var(--font-sans)",
        fontSize: s.font,
        fontWeight: "var(--weight-semibold)",
        lineHeight: 1,
        borderRadius: "var(--radius-lg)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        transition: "opacity .12s ease, filter .12s ease",
        ...v,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
