import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained production bundle in .next/standalone
  // that includes only the server code needed at runtime.
  // Static assets from .next/static and public/ must be copied alongside it.
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
