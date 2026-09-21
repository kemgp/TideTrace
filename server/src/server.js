import { createApp } from "./app.js";
import { readConfig } from "./config.js";

try {
  const config = readConfig();
  const server = createApp({ config }).listen(config.port, config.host, () => {
    console.log(`TideTrace API: http://${config.host}:${config.port}/api`);
    if (!config.configured) console.log("Supabase is not configured. Copy server/.env.example to server/.env and supply your project URL and publishable key.");
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.on("error", (error) => {
    console.error(error.code === "EADDRINUSE" ? `Port ${config.port} is already in use.` : `Server failed to start (${error.code}).`);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    });
  }
} catch (error) {
  console.error(`Cannot start TideTrace API: ${error.message}`);
  process.exitCode = 1;
}
