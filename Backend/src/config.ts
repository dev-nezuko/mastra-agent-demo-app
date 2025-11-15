export class ConfigError extends Error {}

export type Config = {
  host: string;
  port: number;
  frontendOrigin: string;
  modelTimeoutMs: number;
  openaiApiKey: string;
};

type Env = Record<string, string | undefined>;

function integer(env: Env, name: string, fallback: number, min: number, max: number) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new ConfigError(`${name} must be a whole number between ${min} and ${max} (got "${raw}").`);
  return value;
}

// CORS compares the exact Origin header, so "http://localhost:3000/" would silently block the UI.
function origin(env: Env) {
  const raw = env.FRONTEND_ORIGIN?.trim() || "http://localhost:3000";
  const url = URL.parse(raw);
  if (!url || !["http:", "https:"].includes(url.protocol)) {
    throw new ConfigError(`FRONTEND_ORIGIN must be an http(s) URL such as http://localhost:3000 (got "${raw}").`);
  }
  return url.origin;
}

export function loadConfig(env: Env): Config {
  const openaiApiKey = env.OPENAI_API_KEY?.trim() ?? "";
  if (!openaiApiKey) {
    throw new ConfigError("OPENAI_API_KEY is not set. Copy Backend/.env.example to Backend/.env and add your own key.");
  }
  if (/\s/.test(openaiApiKey)) throw new ConfigError("OPENAI_API_KEY contains whitespace; check the value in Backend/.env.");
  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port: integer(env, "PORT", 3001, 1, 65535),
    frontendOrigin: origin(env),
    modelTimeoutMs: integer(env, "MODEL_TIMEOUT_MS", 40_000, 1_000, 120_000),
    openaiApiKey,
  };
}
