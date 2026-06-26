'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/auth-api';
import { AuthMessage } from './AuthMessage';

export function ResetPasswordForm({
  token,
  onComplete,
  onInvalid,
}: {
  token: string;
  onComplete(): void;
  onInvalid(): void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputClass = 'mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!token) {
      onInvalid();
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <AuthMessage kind="error">{error}</AuthMessage>
      <label className="block text-sm text-zinc-300" htmlFor="reset-password">New password<input id="reset-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>
      <label className="block text-sm text-zinc-300" htmlFor="reset-confirm">Confirm password<input id="reset-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></label>
      <Button type="submit" disabled={loading} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">{loading ? 'Resetting...' : 'Reset password'}</Button>
    </form>
  );
}
