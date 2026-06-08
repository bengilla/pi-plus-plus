"use client";

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

export function WelcomeScreen({ agentName, agentDescription, onStarterClick }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="max-w-lg mx-auto px-6 py-12 text-center fade-in">
        {/* Agent greeting */}
        <div className="text-5xl mb-4">🤖</div>
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>
          {agentName}
        </h1>
        {agentDescription && (
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            {agentDescription}
          </p>
        )}

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
