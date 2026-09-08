import type { LoginRequest, LoginResponse } from "@/domain/auth/models/auth";
import { httpClient } from "@/lib/httpClient";

/**
 * Implementation of AuthRepository that fetches from internal API routes
 */
export class AuthRepositoryImpl {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      return await httpClient.post<LoginResponse>("/auth/login", credentials);
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    }
  }
} 