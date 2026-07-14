export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new ConfigurationError(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ConfigurationError(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function boolean(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ConfigurationError(`${name} must be either true or false.`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const webPort = integer(env, "WEB_PORT", 5174, 1, 65_535);

  return {
    port: integer(env, env.API_PORT !== undefined ? "API_PORT" : "PORT", 3003, 1, 65_535),
    webOrigin: env.WEB_ORIGIN ?? `http://localhost:${webPort}`,
    collectionIntervalMinutes: integer(env, "COLLECTION_INTERVAL_MINUTES", 15, 1, 10_080),
    schedulerEnabled: boolean(env, "SCHEDULER_ENABLED", true),
    rssTimeoutMs: integer(env, "RSS_TIMEOUT_MS", 15_000, 100, 300_000),
    rssMaxResponseBytes: integer(env, "RSS_MAX_RESPONSE_BYTES", 2_000_000, 1_024, 50_000_000),
    rssMaxRedirects: integer(env, "RSS_MAX_REDIRECTS", 5, 0, 10),
    shutdownTimeoutMs: integer(env, "SHUTDOWN_TIMEOUT_MS", 10_000, 1_000, 60_000),
  } as const;
}

export type AppConfig = ReturnType<typeof loadConfig>;

export const config = loadConfig();
