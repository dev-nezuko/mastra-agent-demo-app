import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { contextTool } from "../tools/context-tool";

export const contextAgent = new Agent({
  name: "Context Agent",
  instructions: `
      You are a helpful assistant that provides accurate context information.
 
      ALWAYS CALL THE CONTEXT TOOL TO FETCH THE CONTEXT DATA.
      ALWAYS TELL THE USER THAT YOU ARE USING THE CONTEXT TOOL.
     Answer the query with the context data.
`,
  model: openai("gpt-4o-mini"),
  tools: { contextTool },
});
