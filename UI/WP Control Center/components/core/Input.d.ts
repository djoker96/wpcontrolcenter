import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional field label rendered above the input. */
  label?: string;
  /** Optional helper text rendered below the input. */
  hint?: string;
}

/**
 * Single-line text field with optional label + hint.
 *
 * @startingPoint section="Core" subtitle="Input — labelled field" viewport="700x140"
 */
export function Input(props: InputProps): JSX.Element;
