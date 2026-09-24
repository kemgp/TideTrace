import { once } from "node:events";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";

// Read-only smoke check against the configured Supabase project. No test users,
// records, emails, or sessions are created. Never print tokens or record bodies.
const check = (condition, message) => { if (!condition) throw new Error(message); };
let server;
try {
  const config = readConfig();
  check(config.configured, "Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in server/.env first.");
  server = createApp({ config }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const read = async (path, { token, status = 200 } = {}) => {
    const response = await fetch(`${base}/${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(20000),
    });
    const body = await response.json();
    check(response.status === status, `${path.split("?")[0]} returned HTTP ${response.status}; expected ${status}${body.error?.code ? ` (${body.error.code})` : ""}.`);
    return body.data;
  };
  const categories = await read("categories");
  check(Array.isArray(categories) && categories.every((item) => item.id && typeof item.name === "string" && item.is_active === true), "Categories must contain active, named records.");
  console.log(`PASS: active categories (${categories.length} records).`);
  const traces = await read("traces?limit=25&offset=0");
  check(Array.isArray(traces) && traces.length <= 25, "Trace list must be a paginated array.");
  const publicRows = (rows) => rows.every((item) => item.status === "approved" && item.is_hidden === false && item.deleted_at === null);
  check(publicRows(traces), "The public archive returned non-public records.");
  console.log(`PASS: approved, visible archive (${traces.length} records on first page).`);
  if (categories.length) {
    const categoryId = categories[0].id;
    const filtered = await read(`traces?limit=25&offset=0&category_id=${encodeURIComponent(categoryId)}`);
    check(Array.isArray(filtered) && publicRows(filtered) && filtered.every((item) => item.category_id === categoryId), "Category filtering returned mismatched records.");
    console.log("PASS: server category filter.");
  }
  if (traces.length) {
    const detail = await read(`traces/${traces[0].id}`);
    check(detail.id === traces[0].id && publicRows([detail]), "Public detail must match the approved archive record.");
    console.log("PASS: public Trace detail.");
  } else console.log("SKIP: public detail (no approved records available).");
  await read("contributions", { status: 401 });
  await read("contributions/00000000-0000-4000-8000-000000000000", { status: 401 });
  console.log("PASS: contributions and contribution details reject unauthenticated access.");

  // Optional: supply an existing, short-lived member JWT through the environment.
  // This script does not log in, refresh, or retain it.
  const token = process.env.TIDETRACE_VERIFY_ACCESS_TOKEN;
  if (token) {
    const account = await read("auth/me", { token });
    check(account.id && account.status === "active", "Use a valid session for an active account.");
    const mine = await read("contributions?limit=25&offset=0", { token });
    check(Array.isArray(mine) && mine.every((item) => item.author_id === account.id), "Contributions contain a record owned by another account.");
    console.log(`PASS: authenticated contribution ownership (${mine.length} records on first page).`);
    if (mine.length) {
      const detail = await read(`contributions/${mine[0].id}`, { token });
      check(detail.id === mine[0].id && detail.author_id === account.id, "Contribution detail belongs to another account.");
      console.log("PASS: own contribution detail.");
    } else console.log("SKIP: own contribution detail (account has no contributions).");
    const other = traces.find((item) => item.author_id !== account.id);
    if (other) {
      await read(`contributions/${other.id}`, { token, status: 404 });
      console.log("PASS: another author's contribution cannot be read through the private route.");
    } else console.log("SKIP: cross-account live detail (no other author's public record available).");
  } else console.log("SKIP: authenticated live reads (no TIDETRACE_VERIFY_ACCESS_TOKEN supplied).");
} catch (error) {
  console.error(`FAIL: ${error.code === "EPERM" ? "Local HTTP ports are blocked in this environment." : error.message}`);
  process.exitCode = 1;
} finally {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
