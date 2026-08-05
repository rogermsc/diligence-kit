/**
 * Logout user by clearing cookies and redirecting to login
 * This is a client-side function
 */
export async function logout() {
  if (typeof window !== 'undefined') {
    try {
      // Try to clear cookies via server-side API route first
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      console.warn('Failed to clear cookies via API, falling back to client-side:', error)
      // Fallback: Clear cookies on client side by making them expire
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    }
    
    // Redirect to login page
    window.location.href = '/'
  }
}

/**
 * Check if response is 401 and handle logout
 */
export function handleUnauthorized(status: number) {
  if (status === 401) {
    console.log('Received 401 response, logging out user...')
    logout()
    return true
  }
  return false
} 