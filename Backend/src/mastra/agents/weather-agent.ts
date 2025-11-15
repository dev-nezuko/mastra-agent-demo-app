import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

import { weatherTool } from "../tools/weather-tool";

export const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions: `Call the weatherTool for the requested location. This is a static demonstration, not a weather provider. Always label the result simulated and never invent current temperature, wind, humidity, or precipitation.`,
  model: openai("gpt-4o-mini"),
  tools: { weatherTool },
});
