import { fileURLToPath } from "node:url";
import { loadWebEnv } from "@nexa/config";

// Fails dev-server/build startup immediately with an aggregated error if
// required environment variables are missing or invalid — never starts
// silently on incomplete configuration.
loadWebEnv();

const monorepoRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @nexa/ui ships raw .tsx source (Next-only consumer, no separate build
  // step) — @nexa/types and @nexa/config ship compiled CommonJS output
  // (needed by apps/api too) and don't require transpilation here.
  transpilePackages: ["@nexa/ui"],
  // Phase 5: minimal-footprint production image. `standalone` traces only
  // the modules actually reachable at runtime into `.next/standalone`
  // (server.js + a pruned node_modules) instead of shipping the whole
  // workspace — see infrastructure/docker/web.Dockerfile. Root must be
  // explicit in an npm-workspaces monorepo: Next's default trace root is
  // apps/web itself, which would miss sibling `packages/*` it depends on.
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
