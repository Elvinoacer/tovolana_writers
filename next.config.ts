import type { NextConfig } from "next";

const remoteHostnames = new Set<string>([
  "images.unsplash.com",
  "lh3.googleusercontent.com",
  "pub-cc07856d657b4a7197710051042b3eda.r2.dev",
]);

const rawR2PublicUrl = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || ""
).trim();
if (rawR2PublicUrl) {
  try {
    const normalizedUrl =
      rawR2PublicUrl.startsWith("http://") ||
      rawR2PublicUrl.startsWith("https://")
        ? rawR2PublicUrl
        : `https://${rawR2PublicUrl}`;
    const parsed = new URL(normalizedUrl);
    if (parsed.hostname) {
      remoteHostnames.add(parsed.hostname);
    }
  } catch {
    // Ignore invalid URL strings in environment
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: Array.from(remoteHostnames).map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  experimental: {
    agentFeedback: true,
  },
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
