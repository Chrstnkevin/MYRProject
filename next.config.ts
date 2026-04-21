import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during build - errors are warnings only
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Also ignore TS errors during build
    ignoreBuildErrors: true,
  },
}

export default nextConfig
