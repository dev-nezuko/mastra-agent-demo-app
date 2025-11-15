import { test } from "node:test";
import { strict as assert } from "node:assert";
import { MockLanguageModelV4 } from "ai/test";
import { createMastra } from "./index.ts";

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };

// First call requests the tool, second call answers with whatever the tool returned.
function toolThenAnswer(toolName: string, input: object) {
  const prompts: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt));
      if (prompts.length === 1) {
        return { content: [{ type: "tool-call", toolCallId: "call-1", toolName, input: JSON.stringify(input) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] };
      }
      return { content: [{ type: "text", text: "Synthetic final answer" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
    },
  });
  return { model, prompts };
}

test("context agent runs the tool and feeds the guide back to the model", async () => {
  const { model, prompts } = toolThenAnswer("contextTool", {});
  const result = await createMastra(model).getAgent("contextAgent").generate("How do I pick a headline?");
  assert.equal(result.text, "Synthetic final answer");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Lead With One Clear Benefit/);
});

test("weather tool echoes the validated location and stays simulated", async () => {
  const { model } = toolThenAnswer("weatherTool", { location: "  Lisbon " });
  const result = await createMastra(model).getAgent("weatherAgent").generate("Weather in Lisbon?");
  assert.deepEqual(result.toolResults.map(r => r.payload.result), [{ output: "Simulated example for Lisbon: sunny. No current weather provider was queried." }]);
});

test("weather tool rejects empty and oversized locations", async () => {
  for (const location of ["   ", "x".repeat(121)]) {
    const { model, prompts } = toolThenAnswer("weatherTool", { location });
    const result = await createMastra(model).getAgent("weatherAgent").generate("Weather?");
    const toolResult = result.toolResults[0]?.payload.result as { error?: boolean; message?: string };
    assert.equal(toolResult?.error, true);
    assert.match(String(toolResult.message), /validation failed/i);
    assert.doesNotMatch(prompts[1], /Simulated example for/);
  }
});
