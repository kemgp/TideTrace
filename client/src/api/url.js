// Empty locally: Vite proxies /api. On Vercel set the Render origin (without /api).
const origin = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

if (origin) {
  const parsed = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.origin !== origin || (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))) {
    throw new Error("VITE_API_URL must be an HTTPS origin without credentials, a path, or /api (HTTP is allowed locally).");
  }
}

export function apiUrl(path) {
  return `${origin}/api/${path}`;
}
