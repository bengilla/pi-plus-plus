"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AppIcon } from "./AppIcon";

// ── Types ────────────────────────────────────────────────────

interface LoopProgress {
  phase: string;
  turn: number;
  maxTurns: number;
  status: "running" | "pass" | "fail";
  message?: string;
}

interface LoopReport {
  goal: string;
  strategy: string;
  turns: number;
  elapsedMs: number;
  verifyCommand: string;
  log: string;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  hasAuth?: boolean;
}

interface Props {
  workspace: string;
  language: "en" | "zh";
  /** Progress state for ChatInput to render */
  onStateChange?: (state: LoopState) => void;
}

export interface LoopState {
  running: boolean;
  progress: { phase: string; turn: number; maxTurns: number; status: string; message?: string } | null;
  report: { goal: string; strategy: string; turns: number; elapsedMs: number; verifyCommand: string; log: string } | null;
  expanded?: boolean;
}

// ── Component ────────────────────────────────────────────────

export function LoopButton({ workspace, language: lang, onStateChange }: Props) {
  const zh = lang === "zh";
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<LoopProgress | null>(null);
  const [report, setReport] = useState<LoopReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [goal, setGoal] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Model selection states
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [makerModel, setMakerModel] = useState<string>("");
  const [checkerModel, setCheckerModel] = useState<string>("");

  // Load models on mount
  useEffect(() => {
    fetch("/api/pi/models")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.models ?? []).filter((m: ModelOption) => m.enabled && m.hasAuth !== false);
        setAvailableModels(list);
        if (list.length > 0) {
          const defModel = data.defaultModel || list[0].id;
          setMakerModel(defModel);

          // Default checkerModel: try to pick a high-quality model (like Claude 3.5 Sonnet, Gemini 1.5 Pro, GPT-4o)
          const preferredChecker = list.find((m: ModelOption) =>
            m.id.toLowerCase().includes("claude-3-5-sonnet") ||
            m.id.toLowerCase().includes("claude-3.5-sonnet") ||
            m.id.toLowerCase().includes("gemini-1.5-pro") ||
            m.id.toLowerCase().includes("gemini-2.0-flash") ||
            m.id.toLowerCase().includes("gpt-4o")
          );
          setCheckerModel(preferredChecker ? preferredChecker.id : defModel);
        }
      })
      .catch(() => {});
  }, []);

  const startLoop = useCallback(async (taskGoal?: string) => {
    const finalGoal = taskGoal || goal.trim();
    if (!finalGoal) return;

    setRunning(true);
    setProgress(null);
    setReport(null);
    setShowReport(false);
    setShowInput(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: finalGoal,
          workspace,
          makerModel: makerModel || undefined,
          checkerModel: checkerModel || undefined,
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "progress" || event.type === "phase") {
                setProgress({
                  phase: event.phase || event.message || "",
                  turn: event.turn || 0,
                  maxTurns: event.maxTurns || 0,
                  status: event.status || "running",
                  message: event.message,
                });
              } else if (event.type === "done") {
                setReport(event.report);
                setProgress(null);
                setRunning(false);
              } else if (event.type === "error") {
                setReport({
                  goal: finalGoal,
                  strategy: `Error: ${event.message}`,
                  turns: 0,
                  elapsedMs: 0,
                  verifyCommand: "",
                  log: event.message || "",
                });
                setProgress(null);
                setRunning(false);
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setRunning(false);
      }
    }
  }, [goal, workspace, makerModel, checkerModel]);

  const cancelLoop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setProgress(null);
  }, []);

  // Notify parent of state changes for progress bar rendering
  useEffect(() => {
    onStateChange?.({ running, progress, report, expanded: showInput });
  }, [running, progress, report, showInput, onStateChange]);

  const formatElapsed = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <>
      {/* Loop Button + Quick Input */}
      <div className="flex items-center gap-1.5 w-full">
        {showInput ? (
          <div className="flex flex-col gap-2 p-2 border w-full" style={{ borderColor: "var(--accent)", background: "var(--bg)" }}>
            <div className="flex items-center gap-1 w-full">
              <input
                ref={inputRef}
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { startLoop(); }
                  if (e.key === "Escape") { setShowInput(false); setGoal(""); }
                }}
                placeholder={zh ? "描述目标，如：修复所有类型错误" : "Describe goal, e.g. Fix all type errors"}
                className="px-2 py-0.5 text-[11px] outline-none flex-1 min-w-0"
                title={zh ? "输入修复目标。Loop 将自动运行代码，验证结果，反复修正直到成功" : "Describe the fix goal. Loop will auto-run code, verify, and retry until it passes."}
                style={{
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "none",
                }}
                autoFocus
              />
              <button
                onClick={() => startLoop()}
                disabled={!goal.trim()}
                className="px-2 py-0.5 text-[11px] font-medium shrink-0"
                style={{
                  background: goal.trim() ? "var(--accent)" : "var(--border-light)",
                  color: goal.trim() ? "#000" : "var(--text-tertiary)",
                }}
              >
                {zh ? "开始" : "Go"}
              </button>
              <button
                onClick={() => { setShowInput(false); setGoal(""); }}
                className="px-1 text-[11px] hover:opacity-70 shrink-0"
                style={{ color: "var(--text-tertiary)" }}
              >
                <AppIcon name="x" size={11} />
              </button>
            </div>
            {availableModels.length > 0 && (
              <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                <div className="flex items-center gap-1">
                  <span>{zh ? "编写 (Maker):" : "Maker:"}</span>
                  <select
                    value={makerModel}
                    onChange={(e) => setMakerModel(e.target.value)}
                    className="outline-none cursor-pointer text-[10px] px-1 py-0.5"
                    style={{
                      background: "var(--bg)",
                      color: "var(--text)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name.includes("/") ? m.name : `${m.provider}/${m.name}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <span>{zh ? "审核 (Checker):" : "Checker:"}</span>
                  <select
                    value={checkerModel}
                    onChange={(e) => setCheckerModel(e.target.value)}
                    className="outline-none cursor-pointer text-[10px] px-1 py-0.5"
                    style={{
                      background: "var(--bg)",
                      color: "var(--text)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name.includes("/") ? m.name : `${m.provider}/${m.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ) : running ? (
          <button
            onClick={cancelLoop}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium"
            style={{
              color: "var(--error)",
              border: "1px solid var(--error)",
              background: "transparent",
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--error)" }} />
            {zh ? "停止" : "Stop"}
          </button>
        ) : (
          <button
            onClick={() => {
              setShowInput(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium"
            style={{
              color: "var(--accent)",
              border: "1px solid var(--accent)",
              background: "transparent",
            }}
            title={zh ? "Loop：输入目标后，AI 自动写代码 → 验证 → 修错 → 审核，循环直到通过" : "Loop: Set a goal, AI auto-codes → verifies → fixes → reviews, repeating until it passes"}
          >
            <AppIcon name="refresh" size={12} />
            Loop
          </button>
        )}
      </div>

      {/* Report Dialog */}
      {report && !running && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgb(0 0 0 / 0.4)" }}
          onClick={() => setReport(null)}
        >
          <div className="mx-4 w-full max-w-lg p-5 text-xs"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-sm" style={{ color: "var(--accent)" }}>
                <span className="inline-flex items-center gap-1.5">
                  <AppIcon name={report.strategy.includes("未能") ? "x" : "check"} size={13} />
                  Loop {zh ? "报告" : "Report"}
                </span>
              </span>
              <button onClick={() => setReport(null)} style={{ color: "var(--text-tertiary)" }}><AppIcon name="x" size={12} /></button>
            </div>

            <div className="space-y-2 mb-3">
              <div><span style={{ color: "var(--text-tertiary)" }}>{zh ? "目标" : "Goal"}:</span> {report.goal}</div>
              <div><span style={{ color: "var(--text-tertiary)" }}>{zh ? "策略" : "Strategy"}:</span> {report.strategy}</div>
              <div><span style={{ color: "var(--text-tertiary)" }}>{zh ? "轮数" : "Turns"}:</span> {report.turns}</div>
              <div><span style={{ color: "var(--text-tertiary)" }}>{zh ? "耗时" : "Time"}:</span> {formatElapsed(report.elapsedMs)}</div>
              <div><span style={{ color: "var(--text-tertiary)" }}>{zh ? "验证" : "Verify"}:</span> <code>{report.verifyCommand}</code></div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowReport(!showReport)}
                className="px-2 py-1 text-[11px]"
                style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
              >
                {showReport ? (zh ? "收起日志" : "Hide log") : (zh ? "展开日志" : "Show log")}
              </button>
              <button
                onClick={() => setReport(null)}
                className="px-2 py-1 text-[11px]"
                style={{ color: "var(--text-tertiary)", border: "1px solid var(--border-light)", background: "transparent" }}
              >
                {zh ? "关闭" : "Close"}
              </button>
            </div>

            {showReport && (
              <pre className="mt-3 p-3 text-[10px] max-h-[300px] overflow-auto whitespace-pre-wrap"
                style={{ background: "oklch(0% 0 0 / 0.1)", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}
              >
                {report.log || (zh ? "无日志" : "No log")}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}
