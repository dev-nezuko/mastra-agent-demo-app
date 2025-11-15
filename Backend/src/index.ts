import { createOpenAI } from "@ai-sdk/openai";
import { createApp } from "./app.ts";
import { ConfigError, loadConfig } from "./config.ts";
import { createDemoModel } from "./mastra/demo-model.ts";
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
const model = config.model.provider === "demo" ? createDemoModel() : createOpenAI({ apiKey: config.model.apiKey })("gpt-4o-mini");
createApp(createMastra(model), config).listen(config.port, config.host, () => {
  const note = config.model.provider === "demo" ? " with the offline demo model (no provider calls)" : "";
  console.log(`Agent demo listening on http://${config.host}:${config.port}${note}`);
});
