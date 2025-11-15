import { MockLanguageModelV4, simulateReadableStream } from "ai/test";

// An offline stand-in for the provider: it really drives the agent loop (tool call, then an
// answer built from the tool result) but every word is canned, so no key or network is needed.

type Prompt = Parameters<MockLanguageModelV4["doGenerate"]>[0]["prompt"];
type Tools = Parameters<MockLanguageModelV4["doGenerate"]>[0]["tools"];

const usage = { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } };
const STOPWORDS = new Set(["the", "and", "for", "how", "what", "can", "should", "with", "that", "this", "your", "you", "does", "make", "into", "about", "one"]);

function lastUserText(prompt: Prompt): string {
  const message = prompt.findLast(m => m.role === "user");
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  return message.content.map(part => (part.type === "text" ? part.text : "")).join(" ");
}

function toolOutput(prompt: Prompt): string | undefined {
  for (const message of prompt) {
    if (message.role !== "tool") continue;
    for (const part of message.content) {
      if (part.type !== "tool-result") continue;
      const value = part.output.type === "json" ? part.output.value : undefined;
      if (value && typeof value === "object" && "output" in value && typeof value.output === "string") return value.output;
    }
  }
  return undefined;
}

function words(text: string) {
  return text.toLowerCase().match(/[a-z]{3,}/g)?.filter(w => !STOPWORDS.has(w)) ?? [];
}

export function closestSection(guide: string, question: string) {
  const sections = guide.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const asked = new Set(words(question).map(w => w.replace(/s$/, "")));
  let best = sections[0] ?? "";
  let bestScore = 0;
  for (const section of sections) {
    const score = words(section).filter(w => asked.has(w.replace(/s$/, ""))).length;
    if (score > bestScore) [best, bestScore] = [section, score];
  }
  return best;
}

function firstStep(tools: Tools, question: string) {
  const tool = tools?.find(t => t.type === "function");
  if (!tool) return { text: "Demo model: no tool is configured for this agent." };
  const location = /for (.+?)\. /.exec(question)?.[1] ?? question;
  return { toolCall: { toolName: tool.name, input: JSON.stringify(tool.name.includes("weather") ? { location } : {}) } };
}

function answer(prompt: Prompt, output: string) {
  if (output.startsWith("Simulated example")) return `Demo model reply. The weather tool says: ${output}`;
  const section = closestSection(output, lastUserText(prompt));
  return `Demo model reply (no provider was called). I used the context tool, and the closest part of the bundled guide is:\n\n${section}`;
}

function nextStep(prompt: Prompt, tools: Tools) {
  const output = toolOutput(prompt);
  return output === undefined ? firstStep(tools, lastUserText(prompt)) : { text: answer(prompt, output) };
}

export function createDemoModel({ chunkDelayInMs = 12 } = {}) {
  return new MockLanguageModelV4({
    provider: "demo",
    modelId: "offline-demo",
    doGenerate: async ({ prompt, tools }) => {
      const step = nextStep(prompt, tools);
      if ("toolCall" in step && step.toolCall) {
        return { content: [{ type: "tool-call", toolCallId: "demo-call", ...step.toolCall }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] };
      }
      return { content: [{ type: "text", text: step.text ?? "" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
    },
    doStream: async ({ prompt, tools }) => {
      const step = nextStep(prompt, tools);
      if ("toolCall" in step && step.toolCall) {
        return { stream: simulateReadableStream({ chunks: [
          { type: "tool-call", toolCallId: "demo-call", ...step.toolCall },
          { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
        ] }) };
      }
      const deltas = (step.text ?? "").split(/(?<=\s)/).map(delta => ({ type: "text-delta" as const, id: "demo-text", delta }));
      return { stream: simulateReadableStream({ chunkDelayInMs, chunks: [
        { type: "text-start", id: "demo-text" },
        ...deltas,
        { type: "text-end", id: "demo-text" },
        { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
      ] }) };
    },
  });
}
