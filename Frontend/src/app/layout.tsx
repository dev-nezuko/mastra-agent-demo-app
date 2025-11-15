import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Context agent · Mastra demo", description: "Ask a tool-assisted agent about bundled advertising guidance." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
