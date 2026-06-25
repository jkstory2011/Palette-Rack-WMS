'use client'

export default function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500
                 hover:bg-gray-700 hover:text-red-400 transition-colors
                 min-h-[40px] flex items-center gap-1"
    >
      🔒 로그아웃
    </button>
  )
}
