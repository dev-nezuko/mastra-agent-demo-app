"use client";
import { useState, useTransition } from "react";
import { getQuestionUrl } from "@/lib/config";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [asked, setAsked] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    const trimmed = question.trim();
    if (!trimmed) { setError("Enter a question first."); return; }
    setError(""); setAnswer(""); setAsked(trimmed);
    startTransition(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(getQuestionUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: trimmed }), signal: controller.signal });
        if (!response.ok) throw new Error("The agent could not complete this request. Check the local backend and try again.");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("text" in data) || typeof data.text !== "string" || !data.text.trim()) throw new Error("The agent returned an empty or invalid answer.");
        setAnswer(data.text);
      } catch (error) {
        setError(error instanceof Error && error.name === "AbortError" ? "The request timed out. Try a shorter question." : error instanceof Error ? error.message : "Unable to reach the agent.");
      } finally { clearTimeout(timeout); }
    });
  }
  return <main className="demo-shell"><header><p className="eyebrow">MASTRA / TOOL DEMO</p><h1>A question.<br/>A little context.</h1><p className="intro">Ask about advertising fundamentals. The agent can consult a bundled guide on benefits, visuals, social proof, and calls to action.</p></header>
    <section className="workspace" aria-label="Ask the context agent"><form onSubmit={submit}><label htmlFor="question">Your question</label><textarea id="question" value={question} maxLength={2000} onChange={event=>setQuestion(event.target.value)} placeholder="How can I make one benefit stand out in an ad?" rows={4} disabled={isPending}/><div className="form-footer"><span>{question.length} / 2,000</span><button disabled={isPending || !question.trim()}>{isPending ? "Consulting the agent…" : "Ask the agent ↗"}</button></div></form><div className="answer" aria-live="polite" aria-busy={isPending}>{error ? <p role="alert">{error}</p> : isPending ? <p>Waiting for the model response…</p> : answer ? <><p className="eyebrow">MODEL RESPONSE</p><h2>{asked}</h2><p className="answer-text">{answer}</p></> : <><p className="eyebrow">WHAT TO EXPECT</p><h2>Static guidance, model-written answers.</h2><p>This is a single-turn demo. It has no uploaded files, retrieval index, conversation memory, or verified citations. Model answers can be wrong.</p></>}</div></section><footer>Local learning prototype · No message history saved by this application · Submitted questions are sent to the configured model provider.</footer></main>;
}
