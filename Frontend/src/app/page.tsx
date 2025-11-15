"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readAnswerStream } from "@/lib/answer-stream";
import { getQuestionStreamUrl } from "@/lib/config";

const MAX_LENGTH = 2000;
const CLIENT_TIMEOUT_MS = 45_000;
const EXAMPLES = [
  "How should an ad focus on one clear benefit?",
  "Where should the call to action go?",
  "What counts as good social proof?",
];

type Status = "idle" | "streaming" | "done" | "error" | "stopped";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const controller = useRef<AbortController | null>(null);
  const streaming = status === "streaming";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (streaming) return;
    const trimmed = question.trim();
    if (!trimmed) {
      setValidation("Write a question first.");
      return;
    }
    setValidation("");
    setError("");
    setAnswer("");
    setAsked(trimmed);
    setStatus("streaming");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(new DOMException("timeout", "TimeoutError")), CLIENT_TIMEOUT_MS);
    try {
      const response = await fetch(getQuestionStreamUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: abort.signal,
      });
      await readAnswerStream(response, delta => setAnswer(previous => previous + delta));
      setStatus("done");
    } catch (caught) {
      if (abort.signal.aborted && !(abort.signal.reason instanceof DOMException && abort.signal.reason.name === "TimeoutError")) {
        setStatus("stopped");
        return;
      }
      setStatus("error");
      if (abort.signal.aborted) setError("The page stopped waiting after 45 seconds. Try a shorter question.");
      else if (caught instanceof Error && caught.name === "AgentError") setError(caught.message);
      else setError("Could not reach the agent. Check that the backend is running on the configured address.");
    } finally {
      clearTimeout(timeout);
      controller.current = null;
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="border-b-2 border-foreground pb-6">
        <p className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span>Copy desk · Mastra context agent</span>
          <span>Tool: bundled advertising guide</span>
        </p>
        <h1 className="mt-6 font-display text-5xl leading-[1.02] font-semibold tracking-tight sm:text-7xl">
          Ask the copy desk.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          One question about writing an ad. The agent looks up a short, bundled style guide (benefits, visuals, social
          proof, calls to action) and writes an answer from it.
        </p>
      </header>

      <main className="mt-8 grid flex-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="brief-heading" className="flex flex-col">
          <h2 id="brief-heading" className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            The brief
          </h2>
          <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
            <label htmlFor="question" className="font-display text-xl font-medium">
              Your question
            </label>
            <textarea
              id="question"
              value={question}
              maxLength={MAX_LENGTH}
              onChange={event => {
                setQuestion(event.target.value);
                if (validation) setValidation("");
              }}
              placeholder="How can I make one benefit stand out in an ad?"
              rows={6}
              disabled={streaming}
              aria-invalid={validation ? true : undefined}
              aria-describedby={validation ? "question-hint question-error" : "question-hint"}
              className="ruled min-h-48 w-full resize-y rounded-sm border border-input bg-card px-4 py-0 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span id="question-hint" className="font-mono text-xs text-muted-foreground">
                {question.length.toLocaleString("en")} / {MAX_LENGTH.toLocaleString("en")} characters
              </span>
              {streaming ? (
                <Button type="button" variant="outline" onClick={() => controller.current?.abort()}>
                  <Square aria-hidden className="size-3.5 fill-current" /> Stop
                </Button>
              ) : (
                <Button type="submit" disabled={!question.trim()}>
                  Ask the agent <ArrowUpRight aria-hidden className="size-4" />
                </Button>
              )}
            </div>
            {validation && (
              <p id="question-error" role="alert" className="text-sm font-medium text-destructive">
                {validation}
              </p>
            )}
          </form>

          <div className="mt-8">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Try one of these</h3>
            <ul className="mt-3 flex flex-col items-start gap-2">
              {EXAMPLES.map(example => (
                <li key={example}>
                  <Button type="button" variant="ghost" size="sm" className="h-auto whitespace-normal px-0 py-1 text-left text-sm underline decoration-accent decoration-1 underline-offset-4 hover:bg-transparent hover:text-accent" disabled={streaming} onClick={() => { setQuestion(example); setValidation(""); }}>
                    {example}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="proof-heading" className="flex min-w-0 flex-col rounded-sm border border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <h2 id="proof-heading" className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              The proof
            </h2>
            <StatusLabel status={status} />
          </div>
          <div className="flex-1 border-l-4 border-accent px-5 py-6 sm:px-7" aria-live="polite" aria-busy={streaming}>
            {status === "idle" ? (
              <EmptyProof />
            ) : (
              <article>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">You asked</p>
                <p className="mt-1 font-display text-2xl leading-snug font-medium">{asked}</p>
                {(answer || streaming) && (
                  <p className={`mt-5 whitespace-pre-wrap break-words text-base leading-relaxed ${streaming ? "caret" : ""}`}>
                    {answer || <span className="text-muted-foreground">Looking up the guide…</span>}
                  </p>
                )}
                {status === "error" && (
                  <div role="alert" className="mt-5 rounded-sm border border-destructive/40 bg-accent-soft px-4 py-3 text-sm">
                    <p className="font-semibold text-destructive">{answer ? "Answer interrupted" : "No answer"}</p>
                    <p className="mt-1">{error}</p>
                  </div>
                )}
                {status === "stopped" && <p className="mt-5 font-mono text-xs text-muted-foreground">Stopped. The partial answer above is incomplete.</p>}
              </article>
            )}
          </div>
        </section>
      </main>

      <footer className="mt-10 border-t border-border pt-4 font-mono text-xs leading-relaxed text-muted-foreground">
        Local learning prototype. Questions go to the backend&apos;s configured model (or its offline demo model); nothing is
        stored by this app. Model answers can be wrong and are not checked against the guide.
      </footer>
    </div>
  );
}

function StatusLabel({ status }: { status: Status }) {
  const labels: Record<Status, string> = { idle: "Waiting for a brief", streaming: "Drafting…", done: "Answered", error: "Failed", stopped: "Stopped" };
  return (
    <span className={`font-mono text-xs ${status === "error" ? "text-destructive" : status === "streaming" ? "text-accent" : "text-muted-foreground"}`}>
      {labels[status]}
    </span>
  );
}

function EmptyProof() {
  return (
    <div className="max-w-prose">
      <p className="font-display text-2xl leading-snug font-medium">Nothing on the proof yet.</p>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Answers appear here as the model writes them. The agent is told to consult its context tool, which returns a
        seven-point advertising guide. There is no upload, retrieval index, memory or citation checking: one question,
        one answer.
      </p>
    </div>
  );
}
