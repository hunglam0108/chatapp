import { authApi } from '@/server/auth';
import { toast } from 'sonner';
import { create } from 'zustand';

export interface UserInfo {
    _id: string
    username: string;
    email: string;
    fullName: string;
    urlAvatar: string;
}

export interface AuthUserContext {
    userInfo : UserInfo | null
    accessToken: string | null;
    isAuthenticated: boolean;
}

export interface AuthState {
    // State
    user: UserInfo | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    /** True sau khi signOut chủ động — guard không được gọi refresh nữa. */
    signedOut: boolean;

    // Các action
    signIn: (username: string, password: string) => Promise<void>;
    signUp: (data: {
        userAcc: string,
        name: string,
        email: string,
        password: string,
    }) => Promise<void>;

    signOut: () => void;
    fetchMe: () => Promise<void>;
    refresh: () => Promise<void>;
    clearState: () => void
}

export const authStore = create<AuthState>()((set, get) => ({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        loading: false,
        signedOut: false,

        signIn: async (username: string, password: string) => {
            set({ loading: true })
            try {
                const response = await authApi.signIn(username, password)

                if (!response.accessToken) {
                    throw new Error('Sign in failed')
                }

                // Response của signIn chỉ có token — load đầy đủ
                // profile ngay sau đó để user._id v.v. chính xác.
                set({
                    accessToken: response.accessToken,
                    isAuthenticated: true,
                    signedOut: false,
                })
                await get().fetchMe()
                toast.success('Login successfully')
            }
            catch(err) {
                set({
                    user: null,
                    accessToken: null,
                    isAuthenticated: false,
                })
                const message =
                    err instanceof Error && err.message
                        ? err.message
                        : 'Login fail'
                toast.error(message)
                // Throw lại để form login biết xác thực thất bại và
                // không redirect user vào app.
                throw err
            }
            finally {
                set({ loading: false })
            }
        },
        signUp: async (data) => {
            try {
                set({ loading: true })
                await authApi.signUp(data.userAcc, data.email, data.password, data.name)
                toast.success('Sign up successfully')
                set({ loading: false })
            }
            catch(err) {
                console.log(err)
                toast.error('Fail')
                set({ loading: false })
            }
        },
        signOut: () =>
            set({
                user: null,
                accessToken: null,
                isAuthenticated: false,
                // Đánh dấu để ProtectRoute không gọi refresh() ngay sau khi
                // logout trong lúc redirect về /signin vẫn đang diễn ra.
                signedOut: true,
            }),
        fetchMe: async() =>{
            try {
                set({ loading: true })

                const response = await authApi.authMe()
                set({
                    user: {
                        _id: response._id,
                        username: response.username,
                        email: response.email,
                        // /user/me trả về displayName & avatarUrl — map chúng
                        // sang dạng UserInfo dùng trong toàn app.
                        fullName: response.displayName ?? response.username,
                        urlAvatar: response.avatarUrl ?? '',
                    }
                })
            }
            catch (err) {
                toast.error('Error')
                throw err
            }
            finally {
                set({ loading: false })
            }
        },
        clearState: () => {
            set({
                user: null,
                accessToken: null,
                isAuthenticated: false,
            })
        },
        refresh: async() =>{
            try {
                set({ loading: true })
                const { user } = get()
                const response = await authApi.refresh()
                set({ accessToken: response.accessToken })

                if(!user) {
                    await get().fetchMe()
                }
            }
            catch(err) {
                console.log(err, 'refresh fail')
                get().clearState()
                // Điều hướng do caller (ProtectRoute) xử lý nên
                // không throw lỗi redirect trong logic của store.
                throw err
            }
            finally {
                set({ loading: false })
            }
        }
    }),
);

// export const useUser = () => {
//   const { data: user, ...rest } = useQuery<AuthUserContext>({
//     queryKey: [QUERY_KEYS.user],
//     queryFn: async () => {
//       const response = await authApi.refresh()
//       const user = authStore.getState().user
//       if(!user) {
//         await authStore.getState().fetchMe()
//       }

//       return {
//         userInfo: user,
//         accessToken: response.accessToken,
//         isAuthenticated: true,
//       }
//     },
//     enabled: false,
//     refetchOnMount: false,
//     refetchOnReconnect: false,
//     refetchOnWindowFocus: false,
//     // initialData: StorageEnhance.get(STORAGE_KEYS.user),
//     keepPreviousData: true,
//     onError: (err) => {
//       toast.error('Fail Auth', {description: JSON.stringify(err)})
//       redirect('/')
//     }
//   })
//   return {
//     userInfo: user?.userInfo,
//     accessToken: user?.accessToken,
//     isAuthenticated: user?.isAuthenticated,
//     ...rest
//   }
// };