'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { AuthMessage } from './AuthMessage';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { LoginForm } from './LoginForm';
import { ResetPasswordForm } from './ResetPasswordForm';
import { SignUpForm } from './SignUpForm';
import { VerifyEmailForm } from './VerifyEmailForm';

type AuthMode = 'login' | 'signup' | 'verify-email' | 'forgot-password' | 'reset-password';

export function AuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get('token') || '';
  const initialMode: AuthMode = searchParams.get('mode') === 'reset-password' && resetToken ? 'reset-password' : 'login';
  const oauthError = searchParams.get('oauthError') === 'GOOGLE_AUTH_FAILED' ? 'Google sign-in failed. Please try again.' : '';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (mode === 'reset-password') return;
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then((response) => {
        if (response.ok) router.push('/sites');
      })
      .catch(() => undefined);
  }, [mode, router]);

  const title = useMemo(() => {
    if (mode === 'signup') return 'Create your account';
    if (mode === 'verify-email') return 'Verify your email';
    if (mode === 'forgot-password') return 'Reset your password';
    if (mode === 'reset-password') return 'Choose a new password';
    return 'Welcome back';
  }, [mode]);

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-8 text-zinc-200">
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-600/20 blur-[128px]" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-600/20 blur-[128px]" />
      <section className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <header className="mb-6 text-center">
          <p className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-2xl font-bold text-transparent">WP Control Center</p>
          <h1 className="mt-3 text-xl font-semibold">{title}</h1>
        </header>
        {(mode === 'login' || mode === 'signup') && (
          <div role="tablist" className="mb-6 grid grid-cols-2 rounded-lg bg-zinc-950 p-1">
            <button role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')} className={`min-h-11 rounded-md text-sm ${mode === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>Sign in</button>
            <button role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')} className={`min-h-11 rounded-md text-sm ${mode === 'signup' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>Create account</button>
          </div>
        )}
        <div className="mb-4 space-y-3">
          <AuthMessage kind="error">{oauthError}</AuthMessage>
          <AuthMessage kind="success">{success}</AuthMessage>
        </div>
        {mode === 'login' && <LoginForm initialEmail={email} onNeedsVerification={(nextEmail) => { setEmail(nextEmail); setMaskedEmail(nextEmail); setCooldown(0); setMode('verify-email'); }} onForgotPassword={(nextEmail) => { setEmail(nextEmail); setMode('forgot-password'); }} />}
        {mode === 'signup' && <SignUpForm onRegistered={(nextEmail, masked, seconds) => { setEmail(nextEmail); setMaskedEmail(masked); setCooldown(seconds); setMode('verify-email'); }} />}
        {mode === 'verify-email' && <VerifyEmailForm email={email} maskedEmail={maskedEmail} initialCooldown={cooldown} onVerified={(nextEmail) => { setEmail(nextEmail); setSuccess('Email verified. Sign in to continue.'); setMode('login'); }} onBack={() => setMode('login')} />}
        {mode === 'forgot-password' && <ForgotPasswordForm initialEmail={email} onBack={(nextEmail) => { setEmail(nextEmail); setMode('login'); }} />}
        {mode === 'reset-password' && <ResetPasswordForm token={resetToken} onComplete={() => { setSuccess('Password reset. Sign in with your new password.'); setMode('login'); window.history.replaceState({}, '', '/'); }} onInvalid={() => { setMode('forgot-password'); window.history.replaceState({}, '', '/'); }} />}
      </section>
    </main>
  );
}
