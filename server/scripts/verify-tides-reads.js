import { once } from "node:events";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";

// Read-only: no sessions, lessons, emails, or publication changes are created.
let server;
const check = (condition, message) => { if (!condition) throw new Error(message); };
try {
  const config = readConfig();
  check(config.configured, "Configure server/.env first.");
  server = createApp({ config }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const read = async (path, status = 200, token) => {
    const response = await fetch(`${base}/${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    check(response.status === status, `Unexpected HTTP ${response.status} from ${path.split("?")[0]}; expected ${status}.`);
    return body.data;
  };
  const published = await read("tides?limit=25&offset=0");
  check(Array.isArray(published) && published.length <= 25 && published.every((row) => row.id && row.status === "published" && typeof row.body === "string"), "Published lesson list is invalid.");
  console.log(`PASS: published-only Tides list (${published.length} lessons on first page).`);
  if (published.length) {
    const detail = await read(`tides/${published[0].id}`);
    check(detail.id === published[0].id && detail.status === "published", "Published detail mismatch.");
    console.log("PASS: published lesson detail.");
  } else console.log("SKIP: published detail (no published lessons).");
  await read("tides/00000000-0000-4000-8000-000000000000", 404);
  await read("admin/tides", 401);
  await read("admin/tides/00000000-0000-4000-8000-000000000000", 401);
  console.log("PASS: missing lessons return 404; admin lists and details require sign-in.");
  const token = process.env.TIDETRACE_VERIFY_ACCESS_TOKEN;
  if (token) {
    const account = await read("auth/me", 200, token);
    if (account.role === "admin") {
      const all = await read("admin/tides?limit=25&offset=0", 200, token);
      check(Array.isArray(all), "Admin list is invalid.");
      const hidden = all.find((row) => row.status !== "published");
      if (hidden) {
        await read(`admin/tides/${hidden.id}`, 200, token);
        await read(`tides/${hidden.id}`, 404);
        console.log("PASS: an unpublished lesson is readable by admin and absent from public detail.");
      } else console.log("SKIP: unpublished lesson detail (none available).");
    } else {
      await read("admin/tides", 403, token);
      await read("admin/tides/00000000-0000-4000-8000-000000000000", 403, token);
      console.log("PASS: non-admin account cannot read admin lesson routes.");
    }
  } else console.log("SKIP: signed-in live permissions (no verification session supplied).");
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
