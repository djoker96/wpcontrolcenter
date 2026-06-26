import React from "react";

/** Card — surface container. Hairline border, square corners, white surface. */
export function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: "var(--card)",
        color: "var(--card-foreground)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Card header — title row with optional right-aligned actions. */
export function CardHeader({ title, actions, style, ...rest }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) var(--space-4)",
        borderBottom: "1px solid var(--border)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)", color: "var(--foreground)" }}>{title}</span>
      {actions}
    </div>
  );
}

/** Card body — padded content area. */
export function CardBody({ children, style, ...rest }) {
  return (
    <div style={{ padding: "var(--space-4)", ...style }} {...rest}>
      {children}
    </div>
  );
}
