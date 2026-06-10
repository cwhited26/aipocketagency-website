/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Launch Kit and DIY Kit render markdown content read from src/data at runtime. Trace those files
  // into the serverless bundle so fs reads resolve in production (PA-LAUNCHKIT-IMPL / PA-DIYKIT).
  // Next 14.2 nests this under `experimental`.
  experimental: {
    outputFileTracingIncludes: {
      "/app/launch-kit": ["./src/data/launch-kit/**/*.md"],
      "/api/app/apps/diy-kit/**": [
        "./src/data/diy-kit/**/*.md",
        "./src/data/persona-templates-md/**/*.md",
        "./src/data/workflow-vault/**/*.json",
      ],
    },
  },
  async redirects() {
    return [
      { source: "/capture-pack", destination: "/pocket-agent", permanent: true },
      { source: "/output-pack", destination: "/pocket-agent", permanent: true },
      { source: "/output-pack/:slug*", destination: "/pocket-agent", permanent: true },
    ];
  },
};

export default nextConfig;
