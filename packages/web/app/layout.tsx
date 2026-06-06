import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "agents-web",
  description: "Multi-agent web workspace — Claude Code, Codex, Pi in your browser",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set theme before paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var t = localStorage.getItem('theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="h-screen overflow-hidden flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
