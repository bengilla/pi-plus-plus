"use client";

interface Props {
  agentName: string;
  agentDescription?: string;
  agentVersion?: string;
  onStarterClick: (prompt: string) => void;
  language?: "en" | "zh";
}

const STARTERS = [
  {
    icon: "🧭",
    label: "Codebase orientation",
    desc: "Get a structured overview of the codebase",
    prompt: "Give me a concise overview of this codebase: structure, key files, main flows, and areas to be careful with.",
  },
  {
    icon: "📋",
    label: "Implementation brief",
    desc: "Turn a requirement into a step-by-step plan and execute",
    prompt: "Help me turn this requirement into an implementation plan, then execute it step by step:",
  },
  {
    icon: "🔍",
    label: "Review current work",
    desc: "Check for bugs, regressions, and missing verification",
    prompt: "Review the current project changes for bugs, UI regressions, and missing verification.",
  },
  {
    icon: "🐛",
    label: "Debug an issue",
    desc: "Find relevant code paths and propose a fix",
    prompt: "Investigate this issue. Start by finding the relevant code paths, then propose and implement a fix:",
  },
];

export function WelcomeScreen({ agentName, agentDescription, agentVersion, onStarterClick, language = "en" }: Props) {
  const zh = language === "zh";
  const starters = zh
    ? [
        { icon: "🧭", label: "了解代码库", desc: "获取代码库的结构化概览", prompt: "请简洁梳理这个代码库：目录结构、关键文件、主要流程，以及需要小心的地方。" },
        { icon: "📋", label: "整理实现计划", desc: "把需求整理成计划，按步骤执行", prompt: "请把这个需求整理成实现计划，然后按步骤执行：" },
        { icon: "🔍", label: "检查当前改动", desc: "检查 bug、UI 回归和缺失验证", prompt: "请检查当前项目改动，重点看 bug、UI 回归和缺少的验证。" },
        { icon: "🐛", label: "排查问题", desc: "找到相关代码路径并修复", prompt: "请排查这个问题。先找到相关代码路径，再提出并实现修复：" },
      ]
    : STARTERS;

  return (
    <div className="w-full py-10 fade-in" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-[720px] px-1">
        <div className="mb-7 border-b pb-4" style={{ borderColor: "var(--border-light)" }}>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            <span className="h-1.5 w-1.5" style={{ background: "var(--success)" }} />
            {zh ? "工作区就绪" : "Workspace Ready"}
          </div>
          <h1 className="text-base font-semibold" style={{ color: "var(--text)" }}>
            {agentName}
            {agentVersion && (
              <span className="ml-2 text-xs font-normal px-1.5 py-0.5" style={{ color: "var(--text-tertiary)", background: "var(--bg-hover)", fontFamily: "var(--font-mono)" }}>
                v{agentVersion}
              </span>
            )}
          </h1>
          {agentDescription && (
            <p className="mt-1.5 max-w-[560px] text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {zh
                ? (agentDescription === "Earendil Pi coding agent — multi-provider, RPC mode"
                  ? "Earendil Pi 编码智能体 — 多提供商, RPC 模式"
                  : agentDescription)
                : agentDescription}
            </p>
          )}
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          {starters.map((starter) => (
            <button
              key={starter.label}
              onClick={() => onStarterClick(starter.prompt)}
              className="min-h-[72px] border px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent-dim)]"
              style={{ background: "transparent", borderColor: "var(--border-light)" }}
            >
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text)" }}>
                <span className="text-sm">{starter.icon}</span>
                {starter.label}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                {starter.desc}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 border-t pt-3 text-[11px]" style={{ borderColor: "var(--border-light)", color: "var(--text-tertiary)" }}>
          {zh
            ? "快速沟通用对话模式；需要先提供目标、步骤、参考和素材时，切换到计划模式。"
            : "Use Chat for quick turns, or switch to Brief when you want to provide goals, steps, references, and assets before execution."}
        </div>
      </div>
    </div>
  );
}
