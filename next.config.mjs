/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A lockfile exists higher up this machine's home directory; pin the root so
  // Vercel and local builds trace the same files.
  outputFileTracingRoot: import.meta.dirname,
  // Lets a production build run while `next dev` holds .next — set
  // DIMAGH_DIST=.next-build. Defaults to the normal directory.
  distDir: process.env.DIMAGH_DIST || '.next',
  // three.js ships untranspiled ESM examples; Next handles them, but we keep the
  // transpile list explicit so Vercel builds are deterministic.
  transpilePackages: ['three'],
  experimental: {
    optimizePackageImports: ['@react-three/drei', 'framer-motion'],
  },
};

export default nextConfig;
