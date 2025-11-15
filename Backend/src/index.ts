import { createOpenAI } from "@ai-sdk/openai";
import { createApp } from "./app.ts";
import { ConfigError, loadConfig } from "./config.ts";
import { createMastra } from "./mastra/index.ts";

function readConfig() {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(`Configuration error: ${error.message}`);
    process.exit(1);
  }
}

const config = readConfig();
const model = createOpenAI({ apiKey: config.openaiApiKey })("gpt-4o-mini");
createApp(createMastra(model), config).listen(config.port, config.host, () => {
  console.log(`Agent demo listening on http://${config.host}:${config.port}`);
});
