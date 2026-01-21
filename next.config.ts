import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Разрешаем SVG
    dangerouslyAllowSVG: true,
    // Настраиваем безопасность для SVG
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
