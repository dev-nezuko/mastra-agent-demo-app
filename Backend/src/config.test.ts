import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig } from "./config.ts";

const key = "placeholder-test-key";

test("a missing key fails with a message that says where to put it", () => {
  for (const value of [undefined, "", "   "]) {
    assert.throws(() => loadConfig({ OPENAI_API_KEY: value }), (error: unknown) => error instanceof ConfigError && /OPENAI_API_KEY is not set.*Backend\/\.env/.test(error.message));
  }
  assert.throws(() => loadConfig({ OPENAI_API_KEY: "abc def" }), /whitespace/);
});

test("the offline demo model needs no key and unknown providers are rejected", () => {
  assert.deepEqual(loadConfig({ MODEL_PROVIDER: "demo" }).model, { provider: "demo" });
  assert.throws(() => loadConfig({ MODEL_PROVIDER: "anthropic", OPENAI_API_KEY: key }), /MODEL_PROVIDER must be "openai" or "demo"/);
});

test("defaults keep the server on loopback with a 40 s model deadline", () => {
  assert.deepEqual(loadConfig({ OPENAI_API_KEY: key }), { host: "127.0.0.1", port: 3001, frontendOrigin: "http://localhost:3000", modelTimeoutMs: 40_000, model: { provider: "openai", apiKey: key } });
});

test("numbers and origins are validated and normalised", () => {
  assert.throws(() => loadConfig({ OPENAI_API_KEY: key, PORT: "70000" }), /PORT must be a whole number between 1 and 65535/);
  assert.throws(() => loadConfig({ OPENAI_API_KEY: key, PORT: "3001abc" }), /PORT/);
  assert.throws(() => loadConfig({ OPENAI_API_KEY: key, MODEL_TIMEOUT_MS: "10" }), /MODEL_TIMEOUT_MS/);
  assert.throws(() => loadConfig({ OPENAI_API_KEY: key, FRONTEND_ORIGIN: "localhost:3000" }), /FRONTEND_ORIGIN/);
  const config = loadConfig({ OPENAI_API_KEY: key, FRONTEND_ORIGIN: "http://localhost:3000/", HOST: "0.0.0.0", PORT: "8080" });
  assert.equal(config.frontendOrigin, "http://localhost:3000");
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 8080);
});

test("starting without a key prints one clear line and exits 1, without a stack trace", () => {
  const entry = fileURLToPath(new URL("./index.ts", import.meta.url));
  const result = spawnSync(process.execPath, [entry], { env: { PATH: process.env.PATH ?? "" }, encoding: "utf8", timeout: 20_000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Configuration error: OPENAI_API_KEY is not set/m);
  assert.doesNotMatch(result.stderr, /^\s+at /m);
});
