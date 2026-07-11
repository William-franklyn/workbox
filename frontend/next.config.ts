import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the sticky-notes font + resvg wasm into the image-render function.
  outputFileTracingIncludes: {
    "/api/sticky-notes/image": ["./lib/notes/font.ttf", "./node_modules/@resvg/resvg-wasm/index_bg.wasm"],
  },
};

export default nextConfig;
