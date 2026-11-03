'use client';

import { authStore } from '@/store/authStore'
import { LoadingScreen } from '@/components/ui/loading-screen';
import { useAuthInit } from '@/hooks/use-auth-init';
import { usePathname } from 'next/navigation';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, user } = authStore()
  const pathname = usePathname()
  useAuthInit()

  // Trang auth tự hiển thị trạng thái submit; thay form bằng LoadingScreen sẽ làm nháy UI.
  const isPublicRoute = pathname === '/signin' || pathname === '/signup'

  // Chưa có user (đang refresh, hoặc refresh fail và đang redirect về /signin): không render trang cần đăng nhập.
  if (!isPublicRoute && (loading || !user)) {
    return <LoadingScreen label="Loading..." />
  }

  return <>{children}</>
}
