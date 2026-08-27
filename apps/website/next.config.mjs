/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Minimal-footprint production image (infrastructure/docker/website
  // .Dockerfile). No outputFileTracingRoot override needed here, unlike
  // apps/web — this app has zero @nexa/* workspace package dependencies to
  // trace across the monorepo (see package.json); Next's default trace
  // root (this app's own directory) already covers everything it imports.
  output: "standalone",
};

export default nextConfig;
