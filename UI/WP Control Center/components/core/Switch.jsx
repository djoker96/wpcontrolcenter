import React from "react";

/**
 * Switch — boolean toggle (maintenance mode, cache on/off).
 * Pill-shaped track opts out of the square radius; checked = amber.
 */
export function Switch({ checked = false, onChange, disabled = false, style, ...rest }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!checked)}
      style={{
        width: 40,
        height: 23,
        flex: "none",
        padding: 2,
        border: "none",
        borderRadius: "var(--radius-full)",
        background: checked ? "var(--primary)" : "var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: checked ? "flex-end" : "flex-start",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background .15s ease",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          width: 19,
          height: 19,
          borderRadius: "var(--radius-full)",
          background: "var(--background)",
          boxShadow: "var(--shadow-xs)",
        }}
      />
    </button>
  );
}
