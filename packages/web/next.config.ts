import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js dev tools overlay
  devIndicators: false,
  // Fix workspace root detection (avoid picking ~/package-lock.json)
  outputFileTracingRoot: require("path").resolve(__dirname, "../.."),
};

export default nextConfig;
