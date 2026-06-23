import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ['@crypto-assist/shared'],
  webpack(config) {
    config.resolve.alias['@crypto-assist/shared'] = path.resolve(__dirname, '../shared/src');
    return config;
  },
};

export default nextConfig;
