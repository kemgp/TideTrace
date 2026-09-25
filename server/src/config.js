export function readConfig(env = process.env) {
  const port = Number(env.PORT || 3001);
  const proxyValue = env.TRUST_PROXY_HOPS || "0";
  if (!/^\d+$/.test(proxyValue) || !Number.isSafeInteger(Number(proxyValue))) throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
  const trustProxyHops = Number(proxyValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
  const url = env.SUPABASE_URL || "";
  const key = env.SUPABASE_PUBLISHABLE_KEY || "";
  if (Boolean(url) !== Boolean(key)) throw new Error("Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
  if (url) {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
      throw new Error("SUPABASE_URL must use HTTPS (HTTP is allowed for local Supabase)");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
      throw new Error("SUPABASE_URL must be a project origin, without credentials or a path");
    }
    let anon = false;
    try { anon = JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role === "anon"; } catch { /* Not a legacy JWT. */ }
    if (!key.startsWith("sb_publishable_") && !anon) {
      throw new Error("Use a Supabase publishable or legacy anon key, never a secret/service-role key");
    }
  }
  const origins = (env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173").split(",").map((item) => {
    const origin = item.trim();
    if (new URL(origin).origin !== origin) throw new Error("CLIENT_ORIGIN must contain comma-separated origins");
    return origin;
  });
  return { port, host: env.HOST || "127.0.0.1", url: url.replace(/\/$/, ""), key, origins, trustProxyHops, configured: Boolean(url && key) };
}
