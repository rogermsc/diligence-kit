import type { LoginRequest, LoginResponse } from "../models/auth";

export interface AuthRepository {
  login(credentials: LoginRequest): Promise<LoginResponse>;
} 