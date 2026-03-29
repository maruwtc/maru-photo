import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  turbopack: {
    root: path.join(__dirname, '../../'), // Adjust the path as needed to point to the correct root
  },
};

export default nextConfig;
