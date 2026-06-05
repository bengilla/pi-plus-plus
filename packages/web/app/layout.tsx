import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "agents-web",
  description: "Multi-agent web workspace — Claude Code, Codex, Pi in your browser",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
