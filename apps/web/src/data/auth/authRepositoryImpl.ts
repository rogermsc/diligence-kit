import type { LoginRequest, LoginResponse } from "@/domain/auth/models/auth";
import type { AuthRepository } from "@/domain/auth/repositories/authRepository";
import { httpClient } from "@/lib/httpClient";

/**
 * Implementation of AuthRepository that fetches from internal API routes
 */
export class AuthRepositoryImpl implements AuthRepository {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      return await httpClient.post<LoginResponse>("/auth/login", credentials);
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    }
  }
} 