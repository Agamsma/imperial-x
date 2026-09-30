export const GITHUB_URL = "https://github.com/Agamsma/vajranow";

export const TEAM = [
  { name: "Agam Sharma", role: "Team leader" },
  { name: "Abdeali Jhabuawala", role: "Member" },
  { name: "Samar Kuril", role: "Member" },
  { name: "Krish Patel", role: "Member" },
  { name: "Vipul Singh Adhikari", role: "Member" },
  { name: "Pritika Pangotra", role: "Member" },
];

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every build. Locally we fall back to localhost.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";
