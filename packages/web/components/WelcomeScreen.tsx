"use client";

interface Props {
  agentName: string;
  agentDescription?: string;
  onStarterClick: (prompt: string) => void;
  language?: "en" | "zh";
}

const STARTERS = [
  {
    label: "Codebase orientation",
    prompt: "Give me a concise overview of this codebase: structure, key files, main flows, and areas to be careful with.",
  },
  {
    label: "Implementation brief",
    prompt: "Help me turn this requirement into an implementation plan, then execute it step by step:",
  },
  {
    label: "Review current work",
    prompt: "Review the current project changes for bugs, UI regressions, and missing verification.",
  },
  {
    label: "Debug an issue",
    prompt: "Investigate this issue. Start by finding the relevant code paths, then propose and implement a fix:",
  },
];

export function WelcomeScreen({ agentName, agentDescription, onStarterClick, language = "en" }: Props) {
  const zh = language === "zh";
  const starters = zh
    ? [
        { label: "了解代码库", prompt: "请简洁梳理这个代码库：目录结构、关键文件、主要流程，以及需要小心的地方。" },
        { label: "整理实现计划", prompt: "请把这个需求整理成实现计划，然后按步骤执行：" },
        { label: "检查当前改动", prompt: "请检查当前项目改动，重点看 bug、UI 回归和缺少的验证。" },
        { label: "排查问题", prompt: "请排查这个问题。先找到相关代码路径，再提出并实现修复：" },
      ]
    : STARTERS;

  return (
    <div className="w-full py-10 fade-in" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-[720px] px-1">
        <div className="mb-7 border-b pb-4" style={{ borderColor: "var(--border-light)" }}>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
            {zh ? "工作区就绪" : "Workspace Ready"}
          </div>
          <h1 className="text-base font-semibold" style={{ color: "var(--text)" }}>
            {zh ? `${agentName} 会话` : `${agentName} session`}
          </h1>
          {agentDescription && (
            <p className="mt-1.5 max-w-[560px] text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {agentDescription}
            </p>
          )}
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          {starters.map((starter) => (
            <button
              key={starter.label}
              onClick={() => onStarterClick(starter.prompt)}
              className="min-h-[64px] rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ background: "transparent", borderColor: "var(--border-light)" }}
            >
              <div className="text-xs font-medium" style={{ color: "var(--text)" }}>
                {starter.label}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                {zh ? "准备第一条提示，并保持上下文结构清晰。" : "Prepare the first prompt and keep context structured."}
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
