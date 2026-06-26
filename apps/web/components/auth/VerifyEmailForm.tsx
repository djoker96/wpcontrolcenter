'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthApiError, authApi } from '@/lib/auth-api';
import { AuthMessage } from './AuthMessage';

export function VerifyEmailForm({
  email,
  maskedEmail,
  initialCooldown,
  onVerified,
  onBack,
}: {
  email: string;
  maskedEmail: string;
  initialCooldown: number;
  onVerified(email: string): void;
  onBack(): void;
}) {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authApi.verifyEmail(email, code);
      onVerified(result.email);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    try {
      const result = await authApi.resendVerification(email);
      setCooldown(result.resendAvailableInSeconds);
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.retryAfterSeconds) setCooldown(caught.retryAfterSeconds);
      setError(caught instanceof Error ? caught.message : 'Could not resend the code.');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-zinc-400">Enter the code sent to {maskedEmail}.</p>
      <AuthMessage kind="error">{error}</AuthMessage>
      <label className="block text-sm text-zinc-300" htmlFor="verification-code">
        Verification code
        <input id="verification-code" aria-label="Verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-2 min-h-12 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-violet-500" />
      </label>
      <Button type="submit" disabled={loading || code.length !== 6} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">
        {loading ? 'Verifying...' : 'Verify email'}
      </Button>
      <div className="flex justify-between text-sm">
        <button type="button" onClick={onBack} className="min-h-11 text-zinc-400">Back to sign in</button>
        <button type="button" disabled={cooldown > 0} onClick={resend} className="min-h-11 text-violet-300 disabled:text-zinc-600">
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
