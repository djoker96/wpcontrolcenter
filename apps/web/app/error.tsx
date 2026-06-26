'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service in production
    console.error('[ErrorBoundary] Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Đã xảy ra lỗi
        </h2>
        <p className="text-muted-foreground">
          Ứng dụng gặp lỗi không mong muốn. Vui lòng thử lại hoặc liên hệ quản trị viên.
        </p>

        {error.message && process.env.NODE_ENV === 'development' && (
          <div className="rounded-md bg-muted p-3 text-left text-sm text-muted-foreground">
            <code>{error.message}</code>
          </div>
        )}

        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Mã lỗi: {error.digest}
          </p>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={() => (window.location.href = '/')}
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Về trang chủ
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    </div>
  );
}
