export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Deliberately carries no tokens: the session cookies are written server-side by
 * /api/auth/login, so credentials never enter client-side JavaScript.
 */
export interface LoginResponse {
  success: boolean;
  user: User | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
} 