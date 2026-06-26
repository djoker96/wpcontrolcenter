import { API_URL } from './api';

export class AuthApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthApiError(
      data.code || 'AUTH_REQUEST_FAILED',
      data.message || 'Request failed',
      data.retryAfterSeconds,
    );
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    post<{ user: { id: string; email: string } }>('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    }),
  register: (fullName: string, email: string, password: string) =>
    post<{ verificationRequired: true; email: string; resendAvailableInSeconds: number }>(
      '/auth/register',
      { fullName: fullName.trim(), email: email.trim().toLowerCase(), password },
    ),
  verifyEmail: (email: string, code: string) =>
    post<{ success: true; email: string }>('/auth/verify-email', {
      email: email.trim().toLowerCase(),
      code,
    }),
  resendVerification: (email: string) =>
    post<{ success: true; resendAvailableInSeconds: number }>('/auth/resend-verification', {
      email: email.trim().toLowerCase(),
    }),
  forgotPassword: (email: string) =>
    post<{ success: true; message: string }>('/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    }),
  resetPassword: (token: string, password: string) =>
    post<{ success: true; message: string }>('/auth/reset-password', { token, password }),
};

export const googleStartUrl = `${API_URL}/auth/google/start`;
