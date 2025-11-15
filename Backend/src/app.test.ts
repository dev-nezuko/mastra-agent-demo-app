import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { AddressInfo } from "node:net";
import { createApp, type AgentRegistry, type AppOptions } from "./app.ts";

type Generate = ReturnType<AgentRegistry["getAgent"]>["generate"];

async function withApp(generate: Generate, run: (url: string) => Promise<void>, options: Partial<AppOptions> = {}) {
  const server = createApp({ getAgent: () => ({ generate }) }, options).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function ask(url: string, question: unknown, init: RequestInit = {}) {
  return fetch(url + "/api/question", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }), ...init });
}

function waitForAbort(signal: AbortSignal | undefined) {
  return new Promise<void>(resolve => signal?.addEventListener("abort", () => resolve(), { once: true }));
}

test("validates before calling the model and returns bounded context responses", async () => {
  const calls: string[] = [];
  await withApp(async prompt => { calls.push(prompt); return { text: "Synthetic answer" }; }, async url => {
    for (const question of ["", 12, "x".repeat(2001)]) assert.equal((await ask(url, question)).status, 400);
    assert.equal(calls.length, 0);
    const response = await ask(url, "  Example question  ");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { question: "Example question", text: "Synthetic answer" });
    assert.deepEqual(calls, ["Example question"]);
  });
});

test("weather rejects repeated cities and marks model output simulated", async () => {
  await withApp(async () => ({ text: "Synthetic weather" }), async url => {
    assert.equal((await fetch(url + "/api/weather?city=A&city=B")).status, 400);
    const response = await fetch(url + "/api/weather?city=London");
    assert.equal(((await response.json()) as { simulated: boolean }).simulated, true);
  });
});

test("provider errors stay generic and request bodies have a size limit", async () => {
  await withApp(async () => { throw new Error("private synthetic provider detail"); }, async url => {
    const response = await ask(url, "Example");
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes("private synthetic"), false);
    assert.equal((await ask(url, "x".repeat(20000))).status, 413);
  });
});

test("an aborted run that resolves with empty text becomes a 504, not a blank 200", { timeout: 5000 }, async () => {
  await withApp(async (_prompt, options) => {
    await waitForAbort(options?.abortSignal);
    return { text: "", finishReason: "aborted" };
  }, async url => {
    const response = await ask(url, "Slow question");
    assert.equal(response.status, 504);
    assert.match(((await response.json()) as { error: string }).error, /did not answer within/);
  }, { modelTimeoutMs: 50 });
});

test("a provider that rejects on abort also maps to 504", { timeout: 5000 }, async () => {
  await withApp((_prompt, options) => new Promise((_resolve, reject) => {
    options?.abortSignal?.addEventListener("abort", () => reject(options.abortSignal?.reason));
  }), async url => {
    assert.equal((await ask(url, "Slow question")).status, 504);
  }, { modelTimeoutMs: 50 });
});

test("an empty model answer is reported as a failure", async () => {
  await withApp(async () => ({ text: "   ", finishReason: "stop" }), async url => {
    const response = await ask(url, "Example");
    assert.equal(response.status, 502);
    assert.match(((await response.json()) as { error: string }).error, /empty answer/);
  });
});

test("a client disconnect aborts the model call", { timeout: 5000 }, async () => {
  let seen: AbortSignal | undefined;
  let release!: () => void;
  const aborted = new Promise<void>(resolve => { release = resolve; });
  await withApp(async (_prompt, options) => {
    seen = options?.abortSignal;
    await waitForAbort(seen);
    release();
    return { text: "", finishReason: "aborted" };
  }, async url => {
    const client = new AbortController();
    const pending = ask(url, "Example", { signal: client.signal }).catch(() => undefined);
    setTimeout(() => client.abort(), 50);
    await pending;
    await aborted;
    assert.equal(seen?.aborted, true);
  });
});

test("unsupported body charsets keep their 4xx status instead of a blanket 400", async () => {
  await withApp(async () => ({ text: "unused" }), async url => {
    const response = await fetch(url + "/api/question", { method: "POST", headers: { "Content-Type": "application/json; charset=latin1" }, body: "{}" });
    assert.equal(response.status, 415);
  });
});
