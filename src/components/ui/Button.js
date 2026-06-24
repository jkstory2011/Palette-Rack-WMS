'use client'

/**
 * 현장 작업자용 대형 버튼
 * variant: 'primary' | 'secondary' | 'danger' | 'ghost'
 * size: 'md' | 'lg' | 'xl'
 */
const VARIANTS = {
  primary:   'bg-blue-600 hover:bg-blue-500 text-white border-transparent',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white border-transparent',
  danger:    'bg-red-600  hover:bg-red-500  text-white border-transparent',
  ghost:     'bg-transparent hover:bg-gray-700 text-gray-300 border-gray-600',
}

const SIZES = {
  md: 'px-5 py-3 text-sm min-h-[44px]',
  lg: 'px-6 py-4 text-base min-h-[52px]',
  xl: 'px-8 py-5 text-lg min-h-[60px]',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'lg',
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <button
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-xl font-semibold border
        transition-all duration-150 active:scale-[0.97]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}
