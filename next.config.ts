import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/log", permanent: false }];
  },
};

export default nextConfig;
