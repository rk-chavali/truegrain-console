import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so a build can be served from any path: the console is
// self-hosted, and where it lands is the operator's choice, not ours.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", sourcemap: true },
  server: { port: 5180 },
});
