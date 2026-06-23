import type { NextConfig } from "next"

// Production build produces a self-contained server at
// .next/standalone/apps/web/server.js (consumed by the Dockerfile).
// NEXT_PUBLIC_* vars are inlined automatically by Next.js at build time,
// so NEXT_PUBLIC_API_URL must be present in the build environment.
// The browser calls the API at NEXT_PUBLIC_API_URL. In production behind nginx
// it is same-origin ('self'); in dev it is a different origin (e.g. :3003), so
// its origin must be in connect-src or every XHR/fetch is blocked by CSP.
let apiOrigin = ""
try {
  if (process.env.NEXT_PUBLIC_API_URL) apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL).origin
} catch {
  apiOrigin = ""
}
const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(" ")

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts; 'unsafe-inline' kept for compatibility.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
