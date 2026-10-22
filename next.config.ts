import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image.
  output: "standalone",
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
