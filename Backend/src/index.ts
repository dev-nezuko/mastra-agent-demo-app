import { createApp } from "./app.ts";
import { openai } from "@ai-sdk/openai";
import { createMastra } from "./mastra/index.ts";

if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY in your private environment");
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
createApp(createMastra(openai("gpt-4o-mini"))).listen(port, "127.0.0.1", () => console.log(`Agent demo listening on http://127.0.0.1:${port}`));
