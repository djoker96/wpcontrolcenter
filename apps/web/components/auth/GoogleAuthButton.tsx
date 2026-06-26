import { googleStartUrl } from '@/lib/auth-api';

export function GoogleAuthButton() {
  return (
    <a
      href={googleStartUrl}
      className="flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      Continue with Google
    </a>
  );
}
