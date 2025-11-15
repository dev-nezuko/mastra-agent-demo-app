export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

export function getWeatherUrl(city: string): string {
  const base = API_BASE.replace(/\/$/, "");
  const query = new URLSearchParams({ city }).toString();
  return `${base}/api/weather?${query}`;
}

export function getQuestionUrl(): string {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}/api/question`;
}
