export async function performLogout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}
