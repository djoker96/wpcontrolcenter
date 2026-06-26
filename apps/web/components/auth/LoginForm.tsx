'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuthApiError, authApi } from '@/lib/auth-api';
import { AuthMessage } from './AuthMessage';
import { GoogleAuthButton } from './GoogleAuthButton';

export function LoginForm({
  initialEmail,
  onNeedsVerification,
  onForgotPassword,
}: {
  initialEmail: string;
  onNeedsVerification(email: string): void;
  onForgotPassword(email: string): void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login(email, password);
      router.push('/sites');
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.code === 'EMAIL_NOT_VERIFIED') {
        onNeedsVerification(email.trim().toLowerCase());
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
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-800" />
        <span>or</span>
        <span className="h-px flex-1 bg-zinc-800" />
      </div>
      <AuthMessage kind="error">{error}</AuthMessage>
      <label className="block text-sm text-zinc-300" htmlFor="login-email">
        Email
        <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500" />
      </label>
      <label className="block text-sm text-zinc-300" htmlFor="login-password">
        Password
        <input id="login-password" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500" />
      </label>
      <button type="button" onClick={() => onForgotPassword(email)} className="min-h-11 text-sm text-violet-300 hover:text-violet-200">
        Forgot password?
      </button>
      <Button type="submit" disabled={loading} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">
        {loading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
