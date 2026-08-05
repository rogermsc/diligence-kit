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
      // No client-side fallback is possible: the session cookies are httpOnly, so
      // document.cookie cannot see or clear them. Redirecting is all we can do.
      console.warn('Failed to clear session via API:', error)
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