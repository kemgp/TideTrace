import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { HttpError, result } from "./errors.js";

export function security(config) {
  return (req, res, next) => {
    req.requestId = randomUUID();
    res.set({ "X-Request-Id": req.requestId, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const origin = req.get("Origin");
    if (origin) {
      res.vary("Origin");
      if (!config.origins.includes(origin)) return next(new HttpError(403, "ORIGIN_DENIED", "Origin is not allowed."));
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      // Let the browser remember this answer for 10 minutes instead of asking before every call.
      res.set("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  };
}

export function context(config, gateway) {
  return (req, res, next) => {
    if (!config.configured) return next(new HttpError(503, "NOT_CONFIGURED", "Configure Supabase in server/.env first."));
    const authorization = req.get("Authorization");
    if (authorization && !/^Bearer [^\s]+$/i.test(authorization)) return next(new HttpError(401, "UNAUTHENTICATED", "Use a Bearer access token."));
    req.token = authorization?.slice(7);
    req.db = gateway.client(req.token);
    next();
  };
}

const READS = new Set(["GET", "HEAD"]);

// Who is calling: the Supabase user and the TideTrace profile. Member reads may reuse a check from the last
// 30 seconds (see sessionCache.js). Routes limited to roles (staff, admin) and every write ask Supabase again,
// so losing a role takes effect at once there. A write also drops the caller's cached check once it
// finishes, so the next read sees a changed name, photo or Data Saver setting.
export function authenticate(gateway, { active = true, roles } = {}) {
  return async (req, res, next) => {
    if (!req.token) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const sessions = gateway.sessions;
    const read = READS.has(req.method);
    if (!read) res.on("finish", () => sessions.drop(req.token));
    const cached = read && !roles ? sessions.get(req.token) : null;
    if (cached) {
      req.user = cached.user;
      req.profile = cached.profile;
    } else {
      if (!read) sessions.drop(req.token);
      const user = await gateway.auth("user", { token: req.token, method: "GET" });
      if (!user?.id) throw new HttpError(401, "UNAUTHENTICATED", "Your session is invalid or expired.");
      req.user = { id: user.id, email: user.email };
      const profiles = await result(req.db.rpc("get_my_profile"));
      req.profile = Array.isArray(profiles) ? profiles[0] : profiles;
      if (!req.profile) throw new HttpError(403, "PROFILE_MISSING", "Your login was verified, but your TideTrace profile could not be loaded. Contact the project administrator to check your account profile.");
      if (req.profile.id !== user.id) throw new HttpError(403, "FORBIDDEN", "Profile does not match your session.");
      if (read) sessions.set(req.token, req.user, req.profile);
    }
    if (active && req.profile.status !== "active") throw new HttpError(403, "ACCOUNT_SUSPENDED", "Your account is suspended.");
    if (roles && !roles.includes(req.profile.role)) throw new HttpError(403, "FORBIDDEN", "Your account cannot perform this action.");
    next();
  };
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) {
    error = new HttpError(400, "VALIDATION_ERROR", "Check the supplied fields.", error.issues.map(({ path, message }) => ({ field: path.join("."), message })));
  } else if (error.type === "entity.too.large") {
    error = new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  } else if (error.type === "entity.parse.failed") {
    error = new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  } else if (!(error instanceof HttpError)) {
    // Never log tokens, credentials, full bodies or upstream error payloads.
    console.error(`Request ${req.requestId} failed (${error.name || "Error"})`);
    error = new HttpError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
  }
  res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}), request_id: req.requestId } });
}
