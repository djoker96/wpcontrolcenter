'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        {/* This error page renders when the root layout throws.
            It must include its own <html> and <body> tags. */}
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#09090b',
            color: '#fafafa',
          }}
        >
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Critical Error
            </h1>
            <p style={{ color: '#a1a1aa', marginBottom: '1.5rem' }}>
              Ứng dụng không thể khởi tạo. Vui lòng tải lại trang.
            </p>
            {error.digest && (
              <p style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '1rem' }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                backgroundColor: '#ffffff',
                color: '#09090b',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Tải lại
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
