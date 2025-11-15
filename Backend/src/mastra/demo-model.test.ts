import { test } from "node:test";
import { strict as assert } from "node:assert";
import { closestSection, createDemoModel } from "./demo-model.ts";
import { createMastra } from "./index.ts";
import { ADVERTISING_GUIDE } from "./tools/context-tool.ts";

test("closestSection picks the guide section that shares the most words", () => {
  assert.match(closestSection(ADVERTISING_GUIDE, "Where should the call to action CTA go?"), /^7\. End With a Clear CTA/);
  assert.match(closestSection(ADVERTISING_GUIDE, "How do I use social proof and customer quotes?"), /^5\. Build Social Proof/);
  assert.match(closestSection(ADVERTISING_GUIDE, "zzz"), /^1\. Start With the Customer/);
});

test("the demo model calls the context tool and answers from its output", async () => {
  const result = await createMastra(createDemoModel()).getAgent("contextAgent").generate("How do I add social proof?");
  assert.equal(result.toolCalls.length, 1);
  assert.match(result.text, /^Demo model reply \(no provider was called\)/);
  assert.match(result.text, /Build Social Proof/);
});

test("the demo model streams the weather tool result for the requested city", async () => {
  const stream = await createMastra(createDemoModel({ chunkDelayInMs: 0 })).getAgent("weatherAgent")
    .stream("Demonstrate the static weather tool for Porto. Explicitly say this is simulated, not current weather.");
  let text = "";
  for await (const delta of stream.textStream) text += delta;
  assert.equal(text, "Demo model reply. The weather tool says: Simulated example for Porto: sunny. No current weather provider was queried.");
});
