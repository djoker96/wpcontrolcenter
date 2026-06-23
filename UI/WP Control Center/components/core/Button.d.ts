import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. @default "primary" */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  /** Control height. @default "md" */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Primary action control for the Control Center UI.
 * Square corners, amber primary with dark-amber label.
 *
 * @startingPoint section="Core" subtitle="Button — all variants & sizes" viewport="700x160"
 */
export function Button(props: ButtonProps): JSX.Element;
