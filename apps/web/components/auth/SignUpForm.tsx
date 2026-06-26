'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthApiError, authApi } from '@/lib/auth-api';
import { AuthMessage } from './AuthMessage';
import { GoogleAuthButton } from './GoogleAuthButton';

export function SignUpForm({
  onRegistered,
}: {
  onRegistered(email: string, maskedEmail: string, cooldown: number): void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputClass = 'mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.register(fullName, email, password);
      onRegistered(email.trim().toLowerCase(), result.email, result.resendAvailableInSeconds);
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.code === 'EMAIL_VERIFICATION_PENDING') {
        onRegistered(email.trim().toLowerCase(), email.trim().toLowerCase(), 0);
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <GoogleAuthButton />
      <div className="flex items-center gap-3 text-xs text-zinc-500"><span className="h-px flex-1 bg-zinc-800" /><span>or</span><span className="h-px flex-1 bg-zinc-800" /></div>
      <AuthMessage kind="error">{error}</AuthMessage>
      <label className="block text-sm text-zinc-300" htmlFor="signup-name">Full name<input id="signup-name" autoComplete="name" minLength={2} required value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} /></label>
      <label className="block text-sm text-zinc-300" htmlFor="signup-email">Email<input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>
      <label className="block text-sm text-zinc-300" htmlFor="signup-password">Password<input id="signup-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>
      <label className="block text-sm text-zinc-300" htmlFor="signup-confirm">Confirm password<input id="signup-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></label>
      <Button type="submit" disabled={loading} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">{loading ? 'Creating account...' : 'Create account'}</Button>
    </form>
  );
}
