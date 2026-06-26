import * as React from "react";

export interface SwitchProps {
  /** Current on/off state. @default false */
  checked?: boolean;
  /** Called with the next boolean when toggled. */
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/**
 * Boolean toggle for technical operations (maintenance mode, cache).
 * Pill track; amber when on.
 *
 * @startingPoint section="Core" subtitle="Switch — on / off" viewport="700x100"
 */
export function Switch(props: SwitchProps): JSX.Element;
