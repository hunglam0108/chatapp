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
    // No token in memory: try the refresh cookie flow. On failure the
    // session is really gone — send the user to the sign-in page.
    if (!accessToken) {
      try {
        await refresh()
      } catch {
        router.push('/signin')
        return
      }
    }

    // Token present but profile not loaded yet (e.g. after refresh).
    if (authStore.getState().accessToken && !authStore.getState().user) {
      try {
        await fetchMe()
      } catch {
        router.push('/signin')
      }
    }
  }, [accessToken, refresh, fetchMe, router])

  useEffect(() => {
    // Public routes manage their own access.
    if (pathname === '/signin' || pathname === '/signup') return

    // After an explicit signOut the refresh cookie is gone — don't call
    // refresh() again, just let the redirect to /signin happen.
    if (signedOut) {
      router.push('/signin')
      return
    }

    init()
  }, [pathname, signedOut, router, init])
}