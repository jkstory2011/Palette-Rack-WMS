/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 캐시 무효화 및 동적 렌더링 지원
  experimental: {
    serverComponentsExternalPackages: [],
  },
}
module.exports = nextConfig
