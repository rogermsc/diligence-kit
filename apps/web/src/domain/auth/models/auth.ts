export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
} 