import { Mastra } from '@mastra/core/mastra';
import { weatherAgent } from './agents/weather-agent.ts';
import { contextAgent } from './agents/context-agent.ts';
 
export const mastra = new Mastra({
  agents: { weatherAgent, contextAgent },
});
 