import { test } from "node:test";
import { strict as assert } from "node:assert";
import { AgentError, readAnswerStream } from "./answer-stream.ts";

function ndjson(parts: string[], init: ResponseInit = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "application/x-ndjson" }, ...init });
}

async function collect(response: Response) {
  const deltas: string[] = [];
  try {
    await readAnswerStream(response, delta => deltas.push(delta));
    return { deltas, error: undefined };
  } catch (error) {
    return { deltas, error: error as Error };
  }
}

test("joins deltas even when a JSON line is split across network chunks", async () => {
  const result = await collect(ndjson(['{"type":"text","delta":"Lead "}\n{"type":"te', 'xt","delta":"with one benefit."}\n', '{"type":"done"}\n']));
  assert.deepEqual(result, { deltas: ["Lead ", "with one benefit."], error: undefined });
});

test("an error event keeps the partial text and surfaces the server message", async () => {
  const result = await collect(ndjson(['{"type":"text","delta":"Partial "}\n{"type":"error","message":"The model provider is unavailable. Please try again."}\n']));
  assert.deepEqual(result.deltas, ["Partial "]);
  assert.ok(result.error instanceof AgentError);
  assert.equal(result.error.message, "The model provider is unavailable. Please try again.");
});

test("a stream that stops without done is reported, not shown as complete", async () => {
  const result = await collect(ndjson(['{"type":"text","delta":"Cut off"}\n']));
  assert.match(String(result.error?.message), /closed before the answer was finished/);
});

test("unreadable lines are rejected", async () => {
  const result = await collect(ndjson(["<html>proxy error</html>\n"]));
  assert.match(String(result.error?.message), /could not read/);
});

test("HTTP errors use the server's JSON message, or a status-specific fallback", async () => {
  const withMessage = await collect(new Response(JSON.stringify({ error: "Enter a question between 1 and 2,000 characters" }), { status: 400 }));
  assert.equal(withMessage.error?.message, "Enter a question between 1 and 2,000 characters");
  const timeout = await collect(new Response("gateway timeout", { status: 504 }));
  assert.match(String(timeout.error?.message), /did not answer in time/);
  const generic = await collect(new Response("", { status: 500 }));
  assert.match(String(generic.error?.message), /Check that the backend is running/);
});
