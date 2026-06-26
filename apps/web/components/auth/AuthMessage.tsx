import type { ReactNode } from 'react';

export function AuthMessage({
  kind,
  children,
}: {
  kind: 'error' | 'success';
  children?: ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={
        kind === 'error'
          ? 'rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300'
          : 'rounded-lg border border-emerald-900/50 bg-emerald-950/40 p-3 text-sm text-emerald-300'
      }
    >
      {children}
    </div>
  );
}
