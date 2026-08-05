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
      
      const result = await loginUseCase.execute(credentials)
      console.log("Login successful:", result)
      
      // Save tokens to cookies via API route
      if (result.access_token && result.refresh_token) {
        const cookieResponse = await fetch('/api/auth/set-cookies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          }),
        })

        if (!cookieResponse.ok) {
          throw new Error('Failed to save authentication tokens')
        }

        console.log("Tokens saved to cookies successfully")
        
        // Redirect to dashboard after successful login
        router.push('/dashboard')
        return true
      }
      
      return false
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