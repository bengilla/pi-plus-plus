import { initAgents } from "@/lib/agents";

let initialized = false;

/** Initialize all available agents on first call. Safe to call multiple times. */
export function init(): string[] {
  if (initialized) return [];
  const ids = initAgents();
  initialized = true;
  if (ids.length > 0) {
    console.log(`[pi++] Discovered: ${ids.join(", ")}`);
  } else {
    console.log("[pi++] No agents discovered on this device");
  }
  return ids;
}

/** Re-discover agents (e.g. after PATH change) */
export { initAgents as rediscover } from "@/lib/agents";
