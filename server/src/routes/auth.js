import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { authenticate } from "../middleware.js";
import { credentials, registration } from "../validation.js";
import { sessionResponse } from "../supabase.js";

export function authRoutes(gateway) {
  const router = Router();
  router.use(rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many authentication requests. Try again later.", request_id: req.requestId } }),
  }));
  router.post("/register", async (req, res) => {
    const { email, password, display_name } = registration.parse(req.body);
    const data = await gateway.auth("signup", { body: { email, password, data: { display_name } } });
    res.status(201).json({ data: sessionResponse(data) });
  });
  router.post("/login", async (req, res) => {
    const data = await gateway.auth("token?grant_type=password", { body: credentials.parse(req.body) });
    res.json({ data: sessionResponse(data) });
  });
  router.post("/refresh", async (req, res) => {
    const body = z.object({ refresh_token: z.string().min(1).max(4096) }).strict().parse(req.body);
    res.json({ data: sessionResponse(await gateway.auth("token?grant_type=refresh_token", { body })) });
  });
  router.post("/verify", async (req, res) => {
    const body = z.object({ email: z.email().max(254), token: z.string().regex(/^\d{6,10}$/), type: z.enum(["signup", "recovery"]) }).strict().parse(req.body);
    res.json({ data: sessionResponse(await gateway.auth("verify", { body })) });
  });
  router.post("/resend", async (req, res) => {
    const body = z.object({ email: z.email().max(254) }).strict().parse(req.body);
    await gateway.auth("resend", { body: { ...body, type: "signup" } });
    res.json({ data: { message: "If confirmation is required, an email will be sent." } });
  });
  router.post("/forgot-password", async (req, res) => {
    const body = z.object({ email: z.email().max(254) }).strict().parse(req.body);
    await gateway.auth("recover", { body });
    res.json({ data: { message: "If the account exists, recovery instructions will be sent." } });
  });
  // Suspended users can inspect their account, change their password and sign out.
  router.use(authenticate(gateway, { active: false }));
  router.get("/me", (req, res) => res.json({ data: { ...req.profile, email: req.user.email } }));
  router.put("/password", async (req, res) => {
    const body = z.object({ password: z.string().min(8).max(128), nonce: z.string().max(100).optional() }).strict().parse(req.body);
    await gateway.auth("user", { method: "PUT", token: req.token, body });
    res.sendStatus(204);
  });
  router.post("/logout", async (req, res) => {
    await gateway.auth("logout?scope=local", { token: req.token });
    res.sendStatus(204);
  });
  return router;
}
