export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

export function getQuestionStreamUrl(): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/api/question/stream`;
}
