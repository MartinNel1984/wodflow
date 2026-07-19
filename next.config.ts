import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWsUrl = supabaseUrl.replace(/^https:/, "wss:");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: ${supabaseUrl}; connect-src 'self' ${supabaseUrl} ${supabaseWsUrl} https://payments.yoco.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`,
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Cloudflare Workers runtime has no sharp/image-optimization loader configured.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
