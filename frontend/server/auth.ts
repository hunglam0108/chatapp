import { api } from "./api"

export const authApi = {
    authMe: async () => {
        const response = await api.get<User>('/user/me')
        return response
    },
    updateAvatar: async (avatarUrl: string) => {
        const response = await api.patch<User>('/user/me/avatar', { avatarUrl })
        return response
    },
    updateProfile: async (displayName: string) => {
        const response = await api.patch<User>('/user/me', { displayName })
        return response
    },
    /** socketId: socket của tab hiện tại — server không force-logout socket này. */
    changePassword: async (currentPassword: string, newPassword: string, socketId?: string) => {
        const response = await api.patch<{ message: string }>('/user/me/password', { currentPassword, newPassword, socketId })
        return response
    },
    signIn: async (username: string, password: string) => {
        const response = await api.post<AuthResponse>('/auth/signIn', { username, password })
        return response
    },
    signUp: async (username: string, email: string, password: string, fullName: string) => {
        const response = await api.post('/auth/signUp', { username, email, password, fullName })
        return response
    },
    signOut: async () => {
        const response = await api.post('/auth/signOut')
        return response
    },
    refresh: async () => {
        const response = await api.get<{ accessToken: string }>('/auth/refresh')
        return response
    }
}