import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic tone. @default "neutral" */
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  /** Show a leading status dot. @default false */
  dot?: boolean;
  children?: React.ReactNode;
}

/**
 * Compact status / metadata label. Use `dot` + tone for site health.
 *
 * @startingPoint section="Core" subtitle="Badge — status tones" viewport="700x120"
 */
export function Badge(props: BadgeProps): JSX.Element;
