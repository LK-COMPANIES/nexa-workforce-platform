import { loadWebEnv } from "@nexa/config";

// Fails dev-server/build startup immediately with an aggregated error if
// required environment variables are missing or invalid — never starts
// silently on incomplete configuration.
loadWebEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @nexa/ui ships raw .tsx source (Next-only consumer, no separate build
  // step) — @nexa/types and @nexa/config ship compiled CommonJS output
  // (needed by apps/api too) and don't require transpilation here.
  transpilePackages: ["@nexa/ui"],
};

export default nextConfig;
