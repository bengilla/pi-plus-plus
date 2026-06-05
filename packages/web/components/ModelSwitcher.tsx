"use client";

const AGENTS = [
  { id: "pi", label: "Pi", desc: "Earendil Pi agent" },
  { id: "claude-code", label: "Claude Code", desc: "Anthropic Claude Code" },
  { id: "codex", label: "Codex", desc: "OpenAI Codex + gpt-image2" },
];

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function ModelSwitcher({ value, onChange }: Props) {
  const current = AGENTS.find((a) => a.id === value) ?? AGENTS[0];

  return (
    <div className="relative group">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-2.5 pr-7 py-1 text-xs rounded-md cursor-pointer transition-colors"
        style={{
          background: "var(--color-surface)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
        }}
      >
        {AGENTS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      {/* Dropdown arrow */}
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        width="10" height="6" viewBox="0 0 10 6" fill="none"
      >
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--color-text-secondary)" }} />
      </svg>
    </div>
  );
}
