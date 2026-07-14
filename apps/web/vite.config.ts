import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const envDir = fileURLToPath(new URL("../..", import.meta.url));

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
