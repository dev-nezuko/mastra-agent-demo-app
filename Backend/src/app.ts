import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";

type GenerateOptions = { abortSignal?: AbortSignal };
type StreamChunk = { type: string; payload?: unknown };
type Agent = {
  generate(prompt: string, options?: GenerateOptions): Promise<{ text: string; finishReason?: string }>;
  stream(prompt: string, options?: GenerateOptions): Promise<{ fullStream: AsyncIterable<StreamChunk> }>;
};
export type StreamEvent = { type: "text"; delta: string } | { type: "error"; message: string } | { type: "done" };
export type AgentRegistry = { getAgent(name: "contextAgent" | "weatherAgent"): Agent };
export type AppOptions = { frontendOrigin: string; modelTimeoutMs: number };

const defaults: AppOptions = { frontendOrigin: "http://localhost:3000", modelTimeoutMs: 40_000 };
const PROVIDER_FAILURE = "The model provider is unavailable. Please try again.";

class ModelTimeoutError extends Error {}
class EmptyAnswerError extends Error {}

// Aborts on the deadline or when the client goes away, so abandoned requests stop billing the provider.
function requestSignal(res: Response, timeoutMs: number) {
  const disconnected = new AbortController();
  res.on("close", () => disconnected.abort());
  return { deadline: AbortSignal.timeout(timeoutMs), signal: disconnected.signal };
}

async function generateText(agent: Agent, prompt: string, res: Response, timeoutMs: number) {
  const { deadline, signal } = requestSignal(res, timeoutMs);
  try {
    const result = await agent.generate(prompt, { abortSignal: AbortSignal.any([deadline, signal]) });
    // Mastra resolves (rather than rejects) an aborted run with finishReason "aborted" and empty text.
    if (deadline.aborted || result.finishReason === "aborted") throw new ModelTimeoutError();
    if (!result.text.trim()) throw new EmptyAnswerError();
    return result.text;
  } catch (error) {
    throw deadline.aborted ? new ModelTimeoutError() : error;
  }
}

function deltaText(chunk: StreamChunk) {
  const { payload } = chunk;
  return chunk.type === "text-delta" && typeof payload === "object" && payload !== null && "text" in payload && typeof payload.text === "string" ? payload.text : undefined;
}

function timeoutMessage(timeoutMs: number) {
  return `The model did not answer within ${Math.round(timeoutMs / 1000)} seconds. Try a shorter question.`;
}

// Mastra reports provider failures as "error" chunks inside the stream rather than by throwing,
// so they are translated into one terminal NDJSON event the UI can show next to any partial text.
async function streamAnswer(agent: Agent, prompt: string, res: Response, timeoutMs: number) {
  const { deadline, signal } = requestSignal(res, timeoutMs);
  const abortSignal = AbortSignal.any([deadline, signal]);
  let stream: Awaited<ReturnType<Agent["stream"]>>;
  try {
    stream = await agent.stream(prompt, { abortSignal });
  } catch (error) {
    return sendModelFailure(res, deadline.aborted ? new ModelTimeoutError() : error, timeoutMs);
  }
  res.status(200).set({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" });
  res.flushHeaders();
  const send = (event: StreamEvent) => { if (!res.writableEnded && !res.destroyed) res.write(JSON.stringify(event) + "\n"); };
  let failure: string | undefined;
  let answered = false;
  try {
    for await (const chunk of stream.fullStream) {
      const text = deltaText(chunk);
      if (text) {
        answered ||= text.trim() !== "";
        send({ type: "text", delta: text });
      } else if (chunk.type === "error") {
        failure = PROVIDER_FAILURE;
      }
    }
  } catch {
    failure = PROVIDER_FAILURE;
  }
  if (deadline.aborted) failure = timeoutMessage(timeoutMs);
  else if (!failure && !answered) failure = "The model returned an empty answer. Please try again.";
  send(failure ? { type: "error", message: failure } : { type: "done" });
  res.end();
}

function sendModelFailure(res: Response, error: unknown, timeoutMs: number) {
  if (res.headersSent || res.destroyed) return;
  if (error instanceof ModelTimeoutError) {
    res.status(504).json({ error: timeoutMessage(timeoutMs) });
  } else if (error instanceof EmptyAnswerError) {
    res.status(502).json({ error: "The model returned an empty answer. Please try again." });
  } else {
    res.status(502).json({ error: PROVIDER_FAILURE });
  }
}

export function createApp(registry: AgentRegistry, options: Partial<AppOptions> = {}) {
  const { frontendOrigin, modelTimeoutMs } = { ...defaults, ...options };
  const app = express();
  app.use(cors({ origin: frontendOrigin }));
  app.use(express.json({ limit: "16kb" }));
  app.get("/", (_req, res) => res.json({ ok: true, mode: "agent-demo" }));
  app.get("/api/weather", async (req, res) => {
    const city = req.query.city;
    if (typeof city !== "string" || !city.trim() || city.length > 120) return res.status(400).json({ error: "Provide one city, up to 120 characters" });
    try {
      const text = await generateText(registry.getAgent("weatherAgent"), `Demonstrate the static weather tool for ${city.trim()}. Explicitly say this is simulated, not current weather.`, res, modelTimeoutMs);
      res.json({ city: city.trim(), text, simulated: true });
    } catch (error) {
      sendModelFailure(res, error, modelTimeoutMs);
    }
  });
  app.post("/api/question", async (req, res) => {
    const question = req.body?.question;
    if (typeof question !== "string" || !question.trim() || question.length > 2000) return res.status(400).json({ error: "Enter a question between 1 and 2,000 characters" });
    try {
      const text = await generateText(registry.getAgent("contextAgent"), question.trim(), res, modelTimeoutMs);
      res.json({ question: question.trim(), text });
    } catch (error) {
      sendModelFailure(res, error, modelTimeoutMs);
    }
  });
  app.post("/api/question/stream", async (req, res) => {
    const question = req.body?.question;
    if (typeof question !== "string" || !question.trim() || question.length > 2000) return res.status(400).json({ error: "Enter a question between 1 and 2,000 characters" });
    await streamAnswer(registry.getAgent("contextAgent"), question.trim(), res, modelTimeoutMs);
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500 ? error.status : 500;
    const message = status === 413 ? "Request body is too large" : status < 500 ? "Invalid request body" : "Unexpected server error";
    res.status(status).json({ error: message });
  });
  return app;
}
