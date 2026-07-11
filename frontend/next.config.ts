import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the sticky-notes font into the image-render function (next/og).
  outputFileTracingIncludes: {
    "/api/sticky-notes/image": ["./lib/notes/font.ttf"],
  },
};

export default nextConfig;
