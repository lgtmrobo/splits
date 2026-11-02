/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the Anthropic SDK as a plain Node require on the server instead of
  // bundling it.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
