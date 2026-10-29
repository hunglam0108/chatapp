import { useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { authStore } from '@/store/authStore'
// Import authStore của bạn tại đây, ví dụ:
// import { authStore } from '@/stores/authStore'

export const useAuthInit = () => {
  const { accessToken, signedOut, refresh, fetchMe } = authStore()
  const router = useRouter()
  const pathname = usePathname()

  const init = useCallback(async () => {
    // Không có token trong bộ nhớ: thử flow refresh qua cookie. Nếu thất bại thì
    // session thực sự đã hết — chuyển user về trang đăng nhập.
    if (!accessToken) {
      try {
        await refresh()
      } catch {
        router.push('/signin')
        return
      }
    }

    // Có token nhưng chưa load profile (vd. sau khi refresh).
    if (authStore.getState().accessToken && !authStore.getState().user) {
      try {
        await fetchMe()
      } catch {
        router.push('/signin')
      }
    }
  }, [accessToken, refresh, fetchMe, router])

  useEffect(() => {
    // Route public tự quản lý quyền truy cập.
    if (pathname === '/signin' || pathname === '/signup') return

    // Sau khi signOut chủ động, cookie refresh đã mất — không gọi
    // refresh() nữa, chỉ cần để redirect về /signin diễn ra.
    if (signedOut) {
      router.push('/signin')
      return
    }

    init()
  }, [pathname, signedOut, router, init])
}