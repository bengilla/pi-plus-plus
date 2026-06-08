"use client";

import { memo } from "react";
import type { ReactNode } from "react";
// Import Color variants directly to avoid type issues with CompoundedIcon
import ClaudeCodeColor from "@lobehub/icons/es/ClaudeCode/components/Color";
import CodexColor from "@lobehub/icons/es/Codex/components/Color";
import NousResearchMono from "@lobehub/icons/es/NousResearch/components/Mono";
import OpenClawColor from "@lobehub/icons/es/OpenClaw/components/Color";

interface Props {
  agentId: string;
  size?: number;
}

function AgentIconInner({ agentId, size = 18 }: Props) {
  const innerSize = Math.round(size * 0.86);
  let icon: ReactNode;

  switch (agentId) {
    case "claude-code":
      icon = <ClaudeCodeColor size={innerSize} />;
      break;
    case "codex":
      icon = <CodexColor size={innerSize} />;
      break;
    case "pi":
      icon = (
        <span style={{ fontSize: innerSize * 0.92, lineHeight: 1, fontWeight: 700, color: "oklch(72% 0.12 175)" }}>
          π
        </span>
      );
      break;
    case "openclaw":
      icon = <OpenClawColor size={innerSize} />;
      break;
    case "hermes":
      icon = <NousResearchMono size={innerSize} />;
      break;
    default:
      icon = <span style={{ fontSize: innerSize * 0.72, lineHeight: 1 }}>🤖</span>;
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

export const AgentIcon = memo(AgentIconInner);
