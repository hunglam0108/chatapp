// Dạng dữ liệu trả về từ GET /api/user/me (user doc của mongoose, bỏ password).
interface User {
    _id: string;
    username: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
    phone?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface LoginRequest {
    email: string;
    password: string;
}

interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    fullName: string;
}

// Dạng dữ liệu trả về từ POST /api/auth/signIn — chỉ có token (profile được
// load riêng qua /user/me).
interface AuthResponse {
    message?: string;
    accessToken: string;
}
