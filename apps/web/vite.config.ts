import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Repo root relative to apps/web (no node: builtins — avoids @types/node requirement).
const envDir = "../..";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const configuredPort = Number.parseInt(env.WEB_PORT ?? "5174", 10);

  return {
    envDir,
    plugins: [react()],
    server: {
      port: Number.isFinite(configuredPort) ? configuredPort : 5174,
    },
  };
});
