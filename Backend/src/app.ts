import express from "express";
import cors from "cors";

type Agent = { generate(prompt: string): Promise<{ text: string }> };
export type AgentRegistry = { getAgent(name: "contextAgent" | "weatherAgent"): Agent };

export function createApp(registry: AgentRegistry) {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000" }));
  app.use(express.json({ limit: "16kb" }));
  app.get("/", (_req, res) => res.json({ ok: true, mode: "agent-demo" }));
  app.get("/api/weather", async (req, res) => {
    const city = req.query.city;
    if (typeof city !== "string" || !city.trim() || city.length > 120) return res.status(400).json({ error: "Provide one city, up to 120 characters" });
    try {
      const result = await registry.getAgent("weatherAgent").generate(`Demonstrate the static weather tool for ${city.trim()}. Explicitly say this is simulated, not current weather.`);
      res.json({ city: city.trim(), text: result.text, simulated: true });
    } catch {
      res.status(502).json({ error: "The model provider is unavailable. Please try again." });
    }
  });
  app.post("/api/question", async (req, res) => {
    const question = req.body?.question;
    if (typeof question !== "string" || !question.trim() || question.length > 2000) return res.status(400).json({ error: "Enter a question between 1 and 2,000 characters" });
    try {
      const result = await registry.getAgent("contextAgent").generate(question.trim());
      res.json({ question: question.trim(), text: result.text });
    } catch {
      res.status(502).json({ error: "The model provider is unavailable. Please try again." });
    }
  });
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.type === "entity.too.large" ? 413 : 400).json({ error: "Invalid request body" });
  });
  return app;
}
