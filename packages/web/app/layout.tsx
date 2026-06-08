import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "agents-web",
  description: "Multi-agent web workspace — Claude Code, Codex, Pi in your browser",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning style={{ background: "#1c1917" }}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function() {
            var t = localStorage.getItem('theme');
            var dark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (dark) {
              document.documentElement.setAttribute('data-theme', 'dark');
              document.documentElement.style.background = '#1c1917';
            } else {
              document.documentElement.setAttribute('data-theme', 'light');
              document.documentElement.style.background = '#fafaf9';
            }
          })()`}
        </Script>
      </head>
      <body className="h-screen overflow-hidden flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
