"use client";

import { memo } from "react";

interface Props {
  agentId: string;
  size?: number;
}

function AgentIconInner({ agentId: _agentId, size = 18 }: Props) {
  // Pi-only — always show π
  const innerSize = Math.round(size * 0.86);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span style={{ fontSize: innerSize * 0.92, lineHeight: 1, fontWeight: 700, color: "oklch(72% 0.12 175)" }}>
        π
      </span>
    </span>
  );
}

export const AgentIcon = memo(AgentIconInner);
