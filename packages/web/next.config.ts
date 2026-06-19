import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hide the Next.js dev tools overlay
  devIndicators: false,
  // Fix workspace root detection (avoid picking ~/package-lock.json)
  outputFileTracingRoot: require("path").resolve(__dirname, "../.."),
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
