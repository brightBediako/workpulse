import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client talks to a separate Express API; no Next rewrites required.
  // Set NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SOCKET_URL in Vercel env (build-time).
  poweredByHeader: false,
};

export default nextConfig;
