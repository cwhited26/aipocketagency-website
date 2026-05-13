/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/output-pack/decision-query",
        destination: "/output-pack",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
