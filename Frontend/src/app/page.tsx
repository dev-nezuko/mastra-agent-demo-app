"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getQuestionUrl, getWeatherUrl } from "@/lib/config";

export default function Home() {
  const [question, setquestion] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  type Result = {
    question?: string;
    text?: string;
  }
  const [result, setResult] = useState<Result>({});

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult({});
    const trimmed = question.trim();
    if (!trimmed) {
      setError("Please enter a question name.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(getQuestionUrl(),{
            headers:{
              'Content-Type': 'application/json',
            },
            method: "POST",
            body: JSON.stringify({ question: trimmed }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data: unknown = await res.json();
        setResult(data as Result);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Something went wrong");
        }
      }
    });
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Weather Lookup</h1>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            placeholder="Enter question (e.g. London)"
            value={question}
            onChange={(e) => setquestion(e.target.value)}
            aria-label="question"
            autoComplete="off"
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching
              </span>
            ) : (
              "Check"
            )}
          </Button>
        </form>

        <div className="min-h-[64px] mt-6">
          {isPending && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="relative inline-flex h-4 w-4">
                <span className="animate-spin absolute inline-flex h-4 w-4 rounded-full border-2 border-ring border-t-transparent" />
              </span>
              <span className="animate-fadeIn">Loading weather...</span>
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive mt-2">{error}</div>
          )}
          {result != null && (
            <pre className="mt-4 rounded-lg bg-muted p-4 text-xs overflow-auto">
{JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Using API base: {process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000"}
        </p>
      </div>
    </div>
  );
}
