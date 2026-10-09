// Shape returned by GET /api/user/me (mongoose user doc, minus password).
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

// Shape returned by POST /api/auth/signIn — only the token (profile is
// loaded separately via /user/me).
interface AuthResponse {
    message?: string;
    accessToken: string;
}
