import React from "react";

const TONES = {
  neutral: { background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" },
  primary: { background: "var(--primary)", color: "var(--primary-foreground)", border: "1px solid var(--primary)" },
  success: { background: "color-mix(in oklch, var(--success) 14%, white)", color: "var(--success)", border: "1px solid color-mix(in oklch, var(--success) 35%, white)" },
  warning: { background: "color-mix(in oklch, var(--warning) 16%, white)", color: "var(--warning-foreground)", border: "1px solid color-mix(in oklch, var(--warning) 38%, white)" },
  danger: { background: "color-mix(in oklch, var(--danger) 12%, white)", color: "var(--danger)", border: "1px solid color-mix(in oklch, var(--danger) 32%, white)" },
};

const DOT = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  neutral: "var(--muted-foreground)",
  primary: "var(--primary)",
};

/**
 * Badge — compact status / metadata label. Optional leading dot
 * for site health (online / updates / down).
 */
export function Badge({ tone = "neutral", dot = false, children, style, ...rest }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "2px 9px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-medium)",
        lineHeight: 1.6,
        borderRadius: "var(--radius-md)",
        ...t,
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span style={{ width: 7, height: 7, borderRadius: "var(--radius-full)", background: DOT[tone] || DOT.neutral }} />
      )}
      {children}
    </span>
  );
}
