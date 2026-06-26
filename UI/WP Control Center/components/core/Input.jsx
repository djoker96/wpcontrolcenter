import React from "react";

/**
 * Input — single-line text field. Hairline border, square corners,
 * muted placeholder, amber focus ring.
 */
export function Input({ label, hint, style, id, ...rest }) {
  const inputId = id || (label ? `in-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const field = (
    <input
      id={inputId}
      style={{
        height: "var(--control-h-lg)",
        width: "100%",
        padding: "0 11px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-base)",
        color: "var(--foreground)",
        background: "var(--background)",
        border: "1px solid var(--input)",
        borderRadius: "var(--radius-md)",
        outline: "none",
        boxSizing: "border-box",
        ...style,
      }}
      {...rest}
    />
  );
  if (!label && !hint) return field;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {label && (
        <label htmlFor={inputId} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--foreground)" }}>
          {label}
        </label>
      )}
      {field}
      {hint && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--muted-foreground)" }}>{hint}</span>
      )}
    </div>
  );
}
