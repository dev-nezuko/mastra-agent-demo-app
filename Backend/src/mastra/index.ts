import { Mastra } from '@mastra/core/mastra';
import { weatherAgent } from './agents/weather-agent';
import { contextAgent } from './agents/context-agent';
 
export const mastra = new Mastra({
  agents: { weatherAgent, contextAgent },
});
 