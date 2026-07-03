export async function performLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    window.location.href = '/login'
  }
}
