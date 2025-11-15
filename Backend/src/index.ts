import express, { Request, Response } from "express";
import cors from "cors";
import { mastra } from "./mastra";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/api/v1/auth/login", (req, res) => {
  res.send("Hello World");
});

app.get("/api/weather", async (req: Request, res: Response) => {
  const { city } = req.query as { city?: string };

  if (!city) {
    return res.status(400).send("Missing 'city' query parameter");
  }

  const agent = mastra.getAgent("weatherAgent");

  try {
    const result = await agent.generate(`What's the weather like in ${city}?`);
    res.json({ city, text: result.text });
  } catch (error) {
    console.error("Agent error:", error);
    res.status(500).send("An error occurred while processing your request");
  }
});

app.post("/api/question", async (req: Request, res: Response) => {
  console.log("/api/question body:", req.body);
  const { question } = req.body ?? {};
  if (typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({ error: "'question' must be a non-empty string" });
  }
  try {
    const agent = mastra.getAgent("contextAgent");
    const result = await agent.generate(question);
    res.json({ question, text: result.text });
  } catch (error) {
    console.error("Agent error:", error);
    res.status(500).send("An error occurred while processing your request");
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
