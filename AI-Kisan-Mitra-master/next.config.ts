import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: resolve(__dirname),
  },
};

export default nextConfig;
