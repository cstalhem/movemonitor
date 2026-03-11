import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  async redirects() {
    return [{ source: "/", destination: "/log", permanent: false }];
  },
};

export default nextConfig;
