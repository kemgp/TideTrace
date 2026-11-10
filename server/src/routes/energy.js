import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { HttpError, result } from "../errors.js";

// While ENERGY_ENABLED is off every Tide Energy route answers 404 before anything else runs (before sign-in checks too),
// so a switched-off deploy looks the same as one that never had the feature.
export function energyGuard(config) {
  return (req, res, next) => next(config.energyEnabled ? undefined : new HttpError(404, "NOT_FOUND", "API route not found."));
}

// Member energy: balance and history. All numbers come from the database functions; the API never adds them up.
export function energyRoutes(gateway, config) {
  const router = Router();
  router.use(energyGuard(config));
  router.use(authenticate(gateway));
  router.get("/", async (req, res) => {
    const input = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      offset: z.coerce.number().int().min(0).max(100000).default(0),
      kind: z.enum(["trace", "tide", "quiz"]).optional(),
    }).strict().parse(req.query);
    res.json({ data: await result(req.db.rpc("get_my_energy", { p_limit: input.limit, p_offset: input.offset, p_kind: input.kind ?? null })) });
  });
  return router;
}

// Admin: turn awards on or off. The database validates the change, audits it and stamps who made it.
export function energySettingsRoutes(gateway, config) {
  const router = Router();
  router.use(energyGuard(config));
  router.use(authenticate(gateway, { roles: ["admin"] }));
  router.get("/", async (req, res) => {
    res.json({ data: await result(req.db.rpc("get_energy_settings")) });
  });
  router.put("/", async (req, res) => {
    const input = z.object({ active: z.boolean() }).strict().parse(req.body);
    res.json({ data: await result(req.db.rpc("set_energy_active", { p_active: input.active })) });
  });
  return router;
}
