import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All demo data lives in server memory (no database), so every page and API
  // response is rendered per request. Cache Components is turned off and the
  // root layout opts into `force-dynamic` rendering instead.
  cacheComponents: false,
  poweredByHeader: false,
  // Keep the phone tab bar and draw buttons unobstructed while demoing with `next dev`
  // (compile/runtime errors are still shown).
  devIndicators: false,
  logging: {
    // Forwarded browser logs are appended to .next/dev/logs, which (without a git
    // repo to ignore .next) made every page load trigger a rebuild → full reload loop.
    browserToTerminal: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        // Tailwind only processes global stylesheets. CSS Modules must keep their
        // module type — `as: "*.css"` would otherwise turn them into global CSS
        // and every `styles.foo` lookup would be undefined.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
