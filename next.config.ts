import type { NextConfig } from "next";

// The nowcasting engine is a Python (FastAPI) app under /api/py.
// On Vercel it runs as the Python function api/index.py; locally it runs with
// uvicorn (npm run dev:api) on PY_API_ORIGIN.
const PY_API_ORIGIN = process.env.PY_API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination: process.env.VERCEL ? "/api/index?__path=:path*" : `${PY_API_ORIGIN}/api/py/:path*`,
      },
    ];
  },
};

export default nextConfig;
