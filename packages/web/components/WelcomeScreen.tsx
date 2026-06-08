"use client";

import { useState, useEffect } from "react";

interface Props {
  agentName: string;
  agentDescription?: string;
  onStarterClick: (prompt: string) => void;
}

const STARTERS = [
  { icon: "🔍", label: "Explore the codebase", prompt: "Give me an overview of this codebase — what's the structure, key files, and main patterns?" },
  { icon: "🐛", label: "Debug an issue", prompt: "I'm seeing a bug where... (describe what's happening and what you expected)" },
  { icon: "📝", label: "Write documentation", prompt: "Generate documentation for the key modules in this project." },
  { icon: "🔄", label: "Refactor code", prompt: "Review the code I'm working on and suggest improvements for readability and maintainability." },
  { icon: "🧪", label: "Write tests", prompt: "Write comprehensive tests for the following code." },
  { icon: "⚡", label: "Optimize performance", prompt: "Analyze the performance of this code and suggest optimizations." },
];

const TITLE = "AGENTS-WEB";

function GlitchTitle() {
  const [phase, setPhase] = useState<"glitching" | "settled">("glitching");

  useEffect(() => {
    const t = setTimeout(() => setPhase("settled"), 1600);
    return () => clearTimeout(t);
  }, []);

  const textStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "clamp(28px, 5vw, 44px)",
    fontWeight: 800,
    letterSpacing: "0.08em",
    lineHeight: 1.1,
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  };

  return (
    <div className="mb-5 select-none" style={{ position: "relative", display: "inline-block" }}>
      {/* Invisible spacer */}
      <div style={{ ...textStyle, position: "static", visibility: "hidden" }}>{TITLE}</div>

      {/* Red channel — offset left/top, clips away */}
      <div
        style={{
          ...textStyle,
          color: "oklch(62% 0.22 25)",
          clipPath: phase === "glitching" ? "inset(0 0 0 0)" : "inset(100% 0 0 0)",
          transform: phase === "glitching" ? "translate(-2px, -1px)" : "translate(0, 0)",
          transition: "transform 0.4s ease-out, clip-path 0s 0.4s",
          opacity: phase === "glitching" ? 1 : 0,
          transitionProperty: "transform, opacity, clip-path",
          transitionDuration: "0.4s, 0.3s, 0s",
          transitionDelay: "0s, 0.1s, 0.4s",
          transitionTimingFunction: "ease-out, ease-out, step-end",
          animation: phase === "glitching" ? "glitch-shake-red 0.15s ease-in-out infinite" : "none",
        }}
      >
        {TITLE}
      </div>

      {/* Cyan channel — offset right/bottom */}
      <div
        style={{
          ...textStyle,
          color: "oklch(72% 0.12 200)",
          clipPath: phase === "glitching" ? "inset(0 0 0 0)" : "inset(100% 0 0 0)",
          transform: phase === "glitching" ? "translate(2px, 1px)" : "translate(0, 0)",
          transition: "transform 0.4s ease-out, clip-path 0s 0.4s",
          opacity: phase === "glitching" ? 1 : 0,
          transitionProperty: "transform, opacity, clip-path",
          transitionDuration: "0.4s, 0.3s, 0s",
          transitionDelay: "0s, 0.1s, 0.4s",
          transitionTimingFunction: "ease-out, ease-out, step-end",
          animation: phase === "glitching" ? "glitch-shake-cyan 0.13s ease-in-out infinite" : "none",
        }}
      >
        {TITLE}
      </div>

      {/* Main text — fades in from behind the glitch */}
      <div
        style={{
          ...textStyle,
          color: phase === "settled" ? "var(--text)" : "var(--text)",
          textShadow: phase === "settled"
            ? "0 0 40px oklch(66% 0.19 252 / 0.15), 0 2px 4px rgba(0,0,0,0.3)"
            : "none",
          transition: "text-shadow 0.6s ease-out",
        }}
      >
        {TITLE}
      </div>

      <style>{`
        @keyframes glitch-shake-red {
          0%, 100% { transform: translate(-2px, -1px); }
          25% { transform: translate(2px, 1px); }
          50% { transform: translate(-3px, 0px); }
          75% { transform: translate(0px, -2px); }
        }
        @keyframes glitch-shake-cyan {
          0%, 100% { transform: translate(2px, 1px); }
          33% { transform: translate(-3px, 0px); }
          66% { transform: translate(1px, -2px); }
        }
      `}</style>
    </div>
  );
}

export function WelcomeScreen({ agentName, agentDescription, onStarterClick }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="max-w-lg mx-auto px-6 py-12 text-center fade-in">
        {/* Glitch chromatic title */}
        <GlitchTitle />

        {/* Agent name — subtle below title */}
        <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>
          {agentName}
          {agentDescription && (
            <span style={{ opacity: 0.6 }}> — {agentDescription.slice(0, 60)}</span>
          )}
        </p>

        {/* Starter cards */}
        <div className="grid grid-cols-2 gap-2 text-left">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => onStarterClick(s.prompt)}
              className="flex items-start gap-2.5 p-3 rounded-lg border transition-all hover:opacity-80 text-left"
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
              }}
            >
              <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
              <span className="text-xs leading-snug" style={{ color: "var(--text)" }}>
                {s.label}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
          Type a message or drag & drop files to get started
        </p>
      </div>
    </div>
  );
}
