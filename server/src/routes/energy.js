import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { HttpError, result } from "../errors.js";
import { uuid } from "../validation.js";

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
  // Dashboard card: the lesson that has a quiz waiting, or a recent pass. Registered after "/" so the paths never collide.
  router.get("/quiz-ready", async (req, res) => {
    z.object({}).strict().parse(req.query);
    res.json({ data: await result(req.db.rpc("get_quiz_ready")) });
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

// Admin quiz authoring. These share the /api/admin prefix with the generic admin routes, so each route carries its own guard:
// a router-wide guard here would turn every other admin route into a 404 while the flag is off.
// The database validates and versions the quiz; this layer only checks the shape of the request.
const quizQuestion = z.object({
  prompt: z.string().max(500),
  options: z.array(z.string().max(300)).length(4),
  correct: z.number().int().min(0).max(3).nullable(),
  explanation: z.string().max(1000),
}).strict();
const quizVersion = z.number().int().positive();

export function energyQuizAdminRoutes(gateway, config) {
  const router = Router();
  const open = [energyGuard(config), authenticate(gateway, { roles: ["admin"] })];
  router.get("/tides/:id/quiz", ...open, async (req, res) => {
    res.json({ data: await result(req.db.rpc("admin_get_tide_quiz", { p_tide_id: uuid.parse(req.params.id) })) });
  });
  // `version` is the version the editor loaded (null for a quiz that does not exist yet); a stale one answers 409.
  router.put("/tides/:id/quiz", ...open, async (req, res) => {
    const input = z.object({ version: quizVersion.nullable(), publish: z.boolean(), questions: z.array(quizQuestion).max(5) }).strict().parse(req.body);
    res.json({ data: await result(req.db.rpc("admin_save_tide_quiz", {
      p_tide_id: uuid.parse(req.params.id), p_expected_version: input.version, p_questions: input.questions, p_publish: input.publish,
    })) });
  });
  // Hides the quiz from members without touching its content. Earned energy and passes stay.
  router.post("/tides/:id/quiz/unpublish", ...open, async (req, res) => {
    const input = z.object({ version: quizVersion }).strict().parse(req.body);
    res.json({ data: await result(req.db.rpc("admin_unpublish_tide_quiz", { p_tide_id: uuid.parse(req.params.id), p_expected_version: input.version })) });
  });
  return router;
}

// Member quiz. Grading happens in the database: the key never leaves it until the member has passed, and an attempt returns
// only pass or fail. Per-route guards for the same reason as the admin quiz routes (these share the /api prefix).
export function energyQuizRoutes(gateway, config) {
  const router = Router();
  const open = [energyGuard(config), authenticate(gateway)];
  router.get("/tides/:id/quiz", ...open, async (req, res) => {
    res.json({ data: await result(req.db.rpc("get_tide_quiz", { p_tide_id: uuid.parse(req.params.id) })) });
  });
  router.post("/tides/:id/quiz/attempts", ...open, async (req, res) => {
    const input = z.object({ version: z.number().int().positive(), answers: z.array(z.number().int().min(0).max(3)).length(5) }).strict().parse(req.body);
    res.json({ data: await result(req.db.rpc("submit_tide_quiz", { p_tide_id: uuid.parse(req.params.id), p_version: input.version, p_answers: input.answers })) });
  });
  return router;
}
