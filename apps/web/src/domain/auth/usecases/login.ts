import type { AuthRepositoryImpl } from "@/data/auth/authRepositoryImpl";
import type { LoginRequest, LoginResponse } from "../models/auth";

export class LoginUseCase {
  constructor(private repository: AuthRepositoryImpl) {}

  async execute(credentials: LoginRequest): Promise<LoginResponse> {
    if (!credentials.email || !credentials.email.trim()) {
      throw new Error("Email is required");
    }

    if (!credentials.password || !credentials.password.trim()) {
      throw new Error("Password is required");
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email.trim())) {
      throw new Error("Please enter a valid email address");
    }

    return await this.repository.login({
      email: credentials.email.trim(),
      password: credentials.password,
    });
  }
} 