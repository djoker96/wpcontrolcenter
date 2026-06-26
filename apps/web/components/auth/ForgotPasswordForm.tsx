'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/auth-api';
import { AuthMessage } from './AuthMessage';

export function ForgotPasswordForm({
  initialEmail,
  onBack,
}: {
  initialEmail: string;
  onBack(email: string): void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authApi.forgotPassword(email);
      setSuccess(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <AuthMessage kind="error">{error}</AuthMessage>
      <AuthMessage kind="success">{success}</AuthMessage>
      <label className="block text-sm text-zinc-300" htmlFor="forgot-email">
        Email
        <input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500" />
      </label>
      <Button type="submit" disabled={loading} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">{loading ? 'Sending...' : 'Send reset link'}</Button>
      <button type="button" onClick={() => onBack(email)} className="min-h-11 text-sm text-zinc-400">Back to sign in</button>
    </form>
  );
}
