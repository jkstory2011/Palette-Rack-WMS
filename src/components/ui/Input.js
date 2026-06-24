'use client'

/**
 * 현장 작업자용 대형 인풋
 * 바코드 스캐너 입력 환경을 고려해 자동완성 off, 큰 폰트 기본
 */
export default function Input({
  label,
  error,
  className = '',
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        className={`
          w-full bg-gray-800 border rounded-xl px-4 py-3
          text-white text-base placeholder-gray-500
          min-h-[52px] focus:outline-none focus:ring-2
          transition-colors
          ${error
            ? 'border-red-500 focus:ring-red-500/50'
            : 'border-gray-600 hover:border-gray-500 focus:ring-blue-500/50 focus:border-blue-500'
          }
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
