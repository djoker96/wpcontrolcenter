import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';

export default function Page() {
  return (
    <Suspense>
      <AuthCard />
    </Suspense>
  );
}
