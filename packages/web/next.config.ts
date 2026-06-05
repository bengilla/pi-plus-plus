import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't bundle these packages — they use dynamic imports
  serverExternalPackages: [
    "@agents-web/filesystem",
    "@agents-web/agent-bridge",
    "@earendil-works/pi-ai",
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
  ],
};

export default nextConfig;
