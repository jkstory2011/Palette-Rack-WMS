/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      // 현장 작업자용 최소 터치 영역 보장
      minHeight: {
        'touch': '48px',
      },
      fontSize: {
        // 현장 가독성을 위해 기본보다 한 단계 큰 폰트 스케일
        'field': ['1.0625rem', { lineHeight: '1.5' }],
      },
      colors: {
        // 가동률 상태별 색상
        rack: {
          empty:   '#22c55e', // green-500: 비어있음
          partial: '#f59e0b', // amber-500: 일부 사용 중
          full:    '#ef4444', // red-500:   만석
          locked:  '#6b7280', // gray-500:  사용 불가
        },
      },
    },
  },
  plugins: [],
}
