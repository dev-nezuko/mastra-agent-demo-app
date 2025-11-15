import { Mastra } from "@mastra/core/mastra";
import type { MastraModelConfig } from "@mastra/core/llm";
import { createWeatherAgent } from "./agents/weather-agent.ts";
import { createContextAgent } from "./agents/context-agent.ts";

export function createMastra(model: MastraModelConfig) {
  return new Mastra({
    agents: { weatherAgent: createWeatherAgent(model), contextAgent: createContextAgent(model) },
  });
}
