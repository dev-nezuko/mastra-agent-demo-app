import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { AddressInfo } from "node:net";
import { MockLanguageModelV4 } from "ai/test";
import { createApp, type AgentRegistry, type AppOptions, type StreamEvent } from "./app.ts";
import { createMastra } from "./mastra/index.ts";

type Agent = ReturnType<AgentRegistry["getAgent"]>;
type Chunk = { type: string; payload?: unknown };

async function withStream(stream: Agent["stream"], run: (url: string) => Promise<void>, options: Partial<AppOptions> = {}) {
  const generate: Agent["generate"] = async () => { throw new Error("generate not expected"); };
  await withRegistry({ getAgent: () => ({ generate, stream }) }, run, options);
}

async function withRegistry(registry: AgentRegistry, run: (url: string) => Promise<void>, options: Partial<AppOptions> = {}) {
  const server = createApp(registry, options).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function chunks(...items: Chunk[]) {
  return async () => ({ fullStream: (async function* () { yield* items; })() });
}

async function events(url: string, question: unknown = "Example") {
  const response = await fetch(url + "/api/question/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
  const body = await response.text();
  return { response, body, events: response.ok ? body.trim().split("\n").map(line => JSON.parse(line) as StreamEvent) : [] };
}

const text = (t: string): Chunk => ({ type: "text-delta", payload: { id: "1", text: t } });

test("streams text deltas as NDJSON and ends with done", async () => {
  await withStream(chunks({ type: "start" }, text("Lead "), text("with one benefit."), { type: "finish" }), async url => {
    const result = await events(url);
    assert.equal(result.response.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
    assert.deepEqual(result.events, [{ type: "text", delta: "Lead " }, { type: "text", delta: "with one benefit." }, { type: "done" }]);
  });
});

test("an error chunk after partial text ends the stream with a generic error event", async () => {
  await withStream(chunks(text("Partial "), { type: "error", payload: { error: new Error("private synthetic provider detail") } }, { type: "finish" }), async url => {
    const result = await events(url);
    assert.deepEqual(result.events, [{ type: "text", delta: "Partial " }, { type: "error", message: "The model provider is unavailable. Please try again." }]);
    assert.doesNotMatch(result.body, /private synthetic/);
  });
});

test("a stream with no text is an error, and invalid questions are rejected before streaming", async () => {
  await withStream(chunks({ type: "finish" }), async url => {
    assert.deepEqual((await events(url)).events, [{ type: "error", message: "The model returned an empty answer. Please try again." }]);
    assert.equal((await events(url, "")).response.status, 400);
  });
});

test("failing to open the stream returns a JSON 502", async () => {
  await withStream(async () => { throw new Error("private synthetic provider detail"); }, async url => {
    const result = await events(url);
    assert.equal(result.response.status, 502);
    assert.doesNotMatch(result.body, /private synthetic/);
  });
});

test("hitting the deadline mid-stream reports a timeout", { timeout: 5000 }, async () => {
  const stalled: Agent["stream"] = async (_prompt, options) => ({
    fullStream: (async function* () {
      yield text("Starting ");
      await new Promise(resolve => options?.abortSignal?.addEventListener("abort", resolve, { once: true }));
    })(),
  });
  await withStream(stalled, async url => {
    const result = await events(url);
    assert.equal(result.events.at(-1)?.type, "error");
    assert.match((result.events.at(-1) as { message: string }).message, /did not answer within/);
  }, { modelTimeoutMs: 50 });
});

test("a real Mastra agent whose provider fails mid-stream surfaces an error event", async () => {
  const model = new MockLanguageModelV4({ doStream: async () => { throw new Error("private synthetic provider detail"); } });
  await withRegistry(createMastra(model), async url => {
    const result = await events(url);
    assert.deepEqual(result.events.at(-1), { type: "error", message: "The model provider is unavailable. Please try again." });
    assert.doesNotMatch(result.body, /private synthetic/);
  });
});
