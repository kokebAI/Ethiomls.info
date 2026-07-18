import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // Do not set `output: "export"` — static export disables proxy/middleware redirects.
};

export default nextConfig;
