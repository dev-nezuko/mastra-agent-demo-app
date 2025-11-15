import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherTool = createTool({
  id: "get-weather",
  description: "Return a static simulated weather example; never current weather",
  inputSchema: z.object({
    location: z.string().trim().min(1).max(120).describe("City name"),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ location }) => ({
    output: `Simulated example for ${location}: sunny. No current weather provider was queried.`,
  }),
});
