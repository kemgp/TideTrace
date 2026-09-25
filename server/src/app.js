import express from "express";
import { rateLimit } from "express-rate-limit";
import { readConfig } from "./config.js";
import { createSupabase } from "./supabase.js";
import { HttpError, result } from "./errors.js";
import { context, errorHandler, security } from "./middleware.js";
import { authRoutes } from "./routes/auth.js";
import { contentRoutes } from "./routes/content.js";
import { adminRoutes, staffRoutes } from "./routes/staff.js";
import { mediaRoutes } from "./routes/media.js";

export function createApp({ config = readConfig(), fetchImpl = fetch } = {}) {
  const app = express();
  const gateway = createSupabase(config, fetchImpl);
  app.disable("x-powered-by");
  // Trust only the configured number of proxy hops, never the entire header chain.
  app.set("trust proxy", config.trustProxyHops || false);
  app.use(security(config));
  app.get("/api/health", (req, res) => res.json({ data: { status: "ok", service: "tidetrace-api", configured: config.configured } }));
  app.use("/api", rateLimit({
    windowMs: 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Try again later.", request_id: req.requestId } }),
  }));
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", context(config, gateway));
  app.get("/api/ready", async (req, res) => {
    try { await result(req.db.from("categories").select("id").limit(1)); }
    catch { throw new HttpError(503, "NOT_READY", "Supabase is unavailable or the schema is not installed."); }
    res.json({ data: { status: "ready" } });
  });
  app.use("/api/auth", authRoutes(gateway, config));
  app.use("/api", contentRoutes(gateway));
  app.use("/api", mediaRoutes(gateway));
  app.use("/api/moderation", staffRoutes(gateway));
  app.use("/api/admin", adminRoutes(gateway));
  app.use((req, res, next) => next(new HttpError(404, "NOT_FOUND", "API route not found.")));
  app.use(errorHandler);
  return app;
}
