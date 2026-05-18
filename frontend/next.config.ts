import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  outputFileTracingIncludes: {
    "/*": ["./data/**/*.parquet"],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
