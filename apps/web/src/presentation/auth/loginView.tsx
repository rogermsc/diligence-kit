"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuthViewModel } from "./authViewModel"
import type { LoginRequest } from "@/domain/auth/models/auth"

export default function LoginView() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [checkingAuth, setCheckingAuth] = useState(true)
  const { loading, error, login, clearError } = useAuthViewModel()
  const router = useRouter()

  // Check if user is already authenticated on component mount
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const response = await fetch('/api/auth/check')
        const data = await response.json()
        
        if (data.authenticated) {
          // User is already logged in, redirect to dashboard
          router.push('/dashboard')
          return
        }
      } catch (error) {
        console.error('Error checking authentication:', error)
        // Continue to show login form if check fails
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuthentication()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const credentials: LoginRequest = {
      email,
      password,
    }

    const success = await login(credentials)
    if (success) {
      // Login successful, redirect will happen automatically
      console.log("Login successful, redirecting to dashboard...")
    }
  }

  const handleInputChange = () => {
    if (error) {
      clearError()
    }
  }

  // Show loading spinner while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 transition-colors flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 transition-colors">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <Shield className="h-12 w-12 text-primary mr-3" />
              <h1 className="text-4xl font-bold text-foreground">Diligence Kit</h1>
            </div>
            <p className="text-muted-foreground">
              Sign in to access your investment platform
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      handleInputChange()
                    }}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      handleInputChange()
                    }}
                    required
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 