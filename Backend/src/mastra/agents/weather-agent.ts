import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { weatherTool } from "../tools/weather-tool.ts";

export function createWeatherAgent(model: MastraModelConfig) {
  return new Agent({
    id: "weather-agent",
    name: "Weather Agent",
    instructions: `Call the weatherTool for the requested location. This is a static demonstration, not a weather provider. Always label the result simulated and never invent current temperature, wind, humidity, or precipitation.`,
    model,
    tools: { weatherTool },
  });
}
