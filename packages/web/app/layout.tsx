import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "agents-web",
  description: "Multi-agent web workspace — Claude Code, Codex, Pi in your browser",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning style={{ background: "oklch(16% 0.006 260)" }}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function() {
            var t = localStorage.getItem('theme');
            var dark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (dark) {
              document.documentElement.setAttribute('data-theme', 'dark');
              document.documentElement.style.background = 'oklch(16% 0.006 260)';
            } else {
              document.documentElement.setAttribute('data-theme', 'light');
              document.documentElement.style.background = 'oklch(98% 0.002 260)';
            }
          })()`}
        </Script>
      </head>
      <body className="h-screen overflow-hidden antialiased" style={{ display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}
