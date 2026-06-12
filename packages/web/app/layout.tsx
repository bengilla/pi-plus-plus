import type { Metadata } from "next";
import Script from "next/script";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "pi++",
  description: "Pi coding agent workspace — code, explore, and build with your local AI",
  icons: "/favicon.svg",
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
            var fs = localStorage.getItem('fontScale');
            if (fs) document.documentElement.style.setProperty('--font-scale', fs);
            var lang = localStorage.getItem('language');
            if (lang === 'zh') document.documentElement.lang = 'zh-CN';
            else document.documentElement.lang = 'en';
          })()`}
        </Script>
        <Script id="splash-hide" strategy="lazyOnload">
          {`(function() {
            var el = document.getElementById('pi-plus-plus-splash');
            if (el) {
              el.style.opacity = '0';
              el.style.transition = 'opacity 0.4s ease';
              setTimeout(function() { el.remove(); }, 500);
            }
          })()`}
        </Script>
      </head>
      <body className="h-screen overflow-hidden antialiased" style={{ display: "flex", flexDirection: "column" }}>
        {/* Splash screen — shown until React mounts */}
        <div
          id="pi-plus-plus-splash"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "oklch(16% 0.006 260)",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: "3rem",
              color: "oklch(72% 0.12 175)",
              animation: "pi-pulse 1.2s ease-in-out infinite",
              fontFamily: "system-ui, sans-serif",
              fontWeight: 300,
              userSelect: "none",
            }}
          >
            π
          </span>
        </div>
        <ErrorBoundary>
        {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
