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

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>?![]{}";
const TITLE = "AGENTS-WEB";

function MatrixTitle() {
  const [settled, setSettled] = useState(false);
  const [chars, setChars] = useState<string[]>(() =>
    Array.from({ length: TITLE.length }, () => CHARS[Math.floor(Math.random() * CHARS.length)])
  );

  useEffect(() => {
    // Each character iterates through random chars, slowing down and settling
    const timers: ReturnType<typeof setTimeout>[] = [];
    TITLE.split("").forEach((target, i) => {
      // Each char flips at decreasing speed for ~800ms, then settles
      const start = i * 60; // stagger start
      const settleTime = start + 600 + i * 40;
      const interval = 50;
      const t0 = Date.now();

      const flip = () => {
        const elapsed = Date.now() - t0;
        const done = elapsed >= settleTime;

        setChars((prev) => {
          const next = [...prev];
          next[i] = done ? target : CHARS[Math.floor(Math.random() * CHARS.length)];
          return next;
        });

        if (!done) {
          const remaining = settleTime - elapsed;
          const delay = remaining > 300 ? interval : interval + Math.floor(Math.random() * 80) + 40;
          timers.push(setTimeout(flip, delay));
        } else if (i === TITLE.length - 1) {
          timers.push(setTimeout(() => setSettled(true), 100));
        }
      };

      timers.push(setTimeout(flip, start));
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="mb-5 select-none"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "clamp(28px, 5vw, 44px)",
        fontWeight: 700,
        letterSpacing: "0.08em",
        lineHeight: 1.1,
        color: settled ? "var(--accent)" : "oklch(72% 0.18 155)",
        transition: "color 0.6s ease-out",
        textShadow: settled
          ? "0 0 40px oklch(66% 0.19 252 / 0.3)"
          : "0 0 20px oklch(72% 0.18 155 / 0.5), 0 0 60px oklch(72% 0.18 155 / 0.2)",
      }}
    >
      {chars.map((c, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            opacity: c === TITLE[i] ? 1 : 0.7 + Math.random() * 0.3,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function WelcomeScreen({ agentName, agentDescription, onStarterClick }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="max-w-lg mx-auto px-6 py-12 text-center fade-in">
        {/* Matrix-style title */}
        <MatrixTitle />

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
