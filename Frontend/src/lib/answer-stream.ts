export type StreamEvent = { type: "text"; delta: string } | { type: "error"; message: string } | { type: "done" };

export class AgentError extends Error {
  name = "AgentError";
}

const STATUS_MESSAGES: Record<number, string> = {
  413: "That question is too long for the agent.",
  504: "The model did not answer in time. Try a shorter question.",
};

async function errorFromResponse(response: Response) {
  const body: unknown = await response.json().catch(() => undefined);
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error.trim()) return new AgentError(body.error);
  return new AgentError(STATUS_MESSAGES[response.status] ?? "The agent could not complete this request. Check that the backend is running and try again.");
}

function parseEvent(line: string): StreamEvent {
  let event: unknown;
  try {
    event = JSON.parse(line);
  } catch {
    throw new AgentError("The agent sent a response this page could not read.");
  }
  if (event && typeof event === "object" && "type" in event) {
    if (event.type === "text" && "delta" in event && typeof event.delta === "string") return { type: "text", delta: event.delta };
    if (event.type === "error" && "message" in event && typeof event.message === "string") return { type: "error", message: event.message };
    if (event.type === "done") return { type: "done" };
  }
  throw new AgentError("The agent sent a response this page could not read.");
}

/**
 * Reads the backend's NDJSON answer stream, calling onDelta for each piece of text.
 * Resolves on the final "done" event and rejects with an AgentError for an error event,
 * a non-2xx response, or a stream that ends without either.
 */
export async function readAnswerStream(response: Response, onDelta: (delta: string) => void): Promise<void> {
  if (!response.ok) throw await errorFromResponse(response);
  if (!response.body) throw new AgentError("The agent sent an empty response.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffered += value;
    const lines = buffered.split("\n");
    buffered = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = parseEvent(line);
      if (event.type === "text") onDelta(event.delta);
      else if (event.type === "error") throw new AgentError(event.message);
      else return;
    }
    if (done) throw new AgentError("The connection closed before the answer was finished.");
  }
}
