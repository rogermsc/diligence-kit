"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { LoginRequest } from "@/domain/auth/models/auth"
import { LoginUseCase } from "@/domain/auth/usecases/login"
import { AuthRepositoryImpl } from "@/data/auth/authRepositoryImpl"

/**
 * ViewModel for managing authentication state and interactions
 */
export function useAuthViewModel() {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    const repository = new AuthRepositoryImpl()
    const loginUseCase = new LoginUseCase(repository)

    try {
      setLoading(true)
      setError(null)
      
      // /api/auth/login sets the session cookies server-side; no token ever
      // reaches this code, so there is nothing to persist here.
      const result = await loginUseCase.execute(credentials)

      if (!result.success) {
        return false
      }

      router.push('/dashboard')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }

  const clearError = () => {
    setError(null)
  }

  return {
    loading,
    error,
    login,
    clearError,
  }
} 