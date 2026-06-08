"use client";

import { memo } from "react";
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
  switch (agentId) {
    case "claude-code":
      return <ClaudeCodeColor size={size} />;
    case "codex":
      return <CodexColor size={size} />;
    case "pi":
      return (
        <span style={{ fontSize: size * 0.85, lineHeight: 1, fontWeight: 700, color: "oklch(72% 0.12 175)" }}>
          π
        </span>
      );
    case "openclaw":
      return <OpenClawColor size={size} />;
    case "hermes":
      return <NousResearchMono size={size} />;
    default:
      return <span style={{ fontSize: size * 0.65 }}>🤖</span>;
  }
}

export const AgentIcon = memo(AgentIconInner);
