"use client";

import { memo } from "react";

interface Props {
  agentId: string;
  size?: number;
}

function AgentIconInner({ agentId: _agentId, size = 18 }: Props) {
  return (
    <img
      src="/logo-44.png"
      alt="pi++"
      className="inline-flex shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export const AgentIcon = memo(AgentIconInner);
