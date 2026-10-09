'use client';

import { authStore } from '@/store/authStore'
import { LoadingScreen } from '@/components/ui/loading-screen';
import { useAuthInit } from '@/hooks/use-auth-init';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading } = authStore()
  useAuthInit()

  if (loading) {
    return <LoadingScreen label="Loading..." />
  }

  return <>{children}</>
}
