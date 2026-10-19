import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.{test,spec}.{js,jsx}", "src/**/*.{test,spec}.{js,jsx}"],
    // Stop suite-owned timers/listeners before restoring shared browser APIs.
    sequence: { hooks: "stack" },
  },
});
