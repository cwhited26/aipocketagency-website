/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/capture-pack", destination: "/pocket-agent", permanent: true },
      { source: "/output-pack", destination: "/pocket-agent", permanent: true },
      { source: "/output-pack/:slug*", destination: "/pocket-agent", permanent: true },
    ];
  },
};

export default nextConfig;
