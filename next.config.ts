import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWsUrl = supabaseUrl.replace(/^https:/, "wss:");
// React dev mode needs eval() for its debugging features (never used in
// production builds) — without this, CSP silently breaks client-side
// hydration in `next dev` while the initial HTML still loads fine.
const scriptSrc = process.env.NODE_ENV === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=()" },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; script-src ${scriptSrc} https://static.cloudflareinsights.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: ${supabaseUrl} https://www.google-analytics.com; connect-src 'self' ${supabaseUrl} ${supabaseWsUrl} https://cloudflareinsights.com https://www.google-analytics.com https://region1.google-analytics.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`,
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
