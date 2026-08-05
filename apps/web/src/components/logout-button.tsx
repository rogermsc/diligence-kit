"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { logout } from "@/lib/auth"

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      console.error('Error during logout:', error)
      // logout() should handle the redirect even if there's an error
    } finally {
      // Reset state in case logout fails and doesn't redirect
      setIsLoggingOut(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="flex items-center gap-2"
    >
      <LogOut className="h-4 w-4" />
      {isLoggingOut ? "Logging out..." : "Logout"}
    </Button>
  )
} 