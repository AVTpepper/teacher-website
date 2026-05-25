import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer uses native canvas/fontkit — keep it out of the server bundle
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
