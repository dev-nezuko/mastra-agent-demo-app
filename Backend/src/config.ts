export class ConfigError extends Error {}

export type Config = {
  host: string;
  port: number;
  frontendOrigin: string;
  modelTimeoutMs: number;
  model: { provider: "openai"; apiKey: string } | { provider: "demo" };
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

function model(env: Env): Config["model"] {
  const provider = env.MODEL_PROVIDER?.trim() || "openai";
  if (provider === "demo") return { provider };
  if (provider !== "openai") throw new ConfigError(`MODEL_PROVIDER must be "openai" or "demo" (got "${provider}").`);
  const apiKey = env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new ConfigError("OPENAI_API_KEY is not set. Copy Backend/.env.example to Backend/.env and add your own key, or set MODEL_PROVIDER=demo to run the offline demo model.");
  }
  if (/\s/.test(apiKey)) throw new ConfigError("OPENAI_API_KEY contains whitespace; check the value in Backend/.env.");
  return { provider, apiKey };
}

export function loadConfig(env: Env): Config {
  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port: integer(env, "PORT", 3001, 1, 65535),
    frontendOrigin: origin(env),
    modelTimeoutMs: integer(env, "MODEL_TIMEOUT_MS", 40_000, 1_000, 120_000),
    model: model(env),
  };
}
