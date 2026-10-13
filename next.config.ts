import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All demo data lives in server memory (no database), so every page and API
  // response is rendered per request. Cache Components is turned off and the
  // root layout opts into `force-dynamic` rendering instead.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
