import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { SkillInfo, SkillsResult } from "./types";

// ── Agent skill directory mapping ─────────────────────────
// Each agent stores skills in a different location.
const SKILL_DIRS: Record<string, string> = {
  "claude-code": join(homedir(), ".claude", "skills"),
  pi: join(homedir(), ".pi", "agent", "skills"),
  openclaw: join(homedir(), ".openclaw", "skills"),
  hermes: join(homedir(), ".hermes", "skills"),
};

let cached: Record<string, SkillInfo[]> = {};

export function clearSkillsCache(): void {
  cached = {};
}

// ── Scan ──────────────────────────────────────────────────

export function scanSkills(agentId?: string): SkillsResult[] {
  const agents = agentId ? [agentId] : Object.keys(SKILL_DIRS);

  return agents
    .filter((id) => SKILL_DIRS[id])
    .map((id) => ({
      agentId: id,
      skills: scanAgentSkills(id, SKILL_DIRS[id]),
    }));
}

function scanAgentSkills(agentId: string, dir: string): SkillInfo[] {
  if (cached[agentId]) return cached[agentId];

  if (!existsSync(dir)) {
    cached[agentId] = [];
    return [];
  }

  const skills: SkillInfo[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;

      const skillDir = join(dir, entry.name);
      const parsed = parseSkillMd(skillDir, entry.name, agentId);
      if (parsed) skills.push(parsed);
    }
  } catch {
    // Permission errors etc.
  }

  // Sort by name
  skills.sort((a, b) => a.name.localeCompare(b.name));
  cached[agentId] = skills;
  return skills;
}

// ── SKILL.md parser ───────────────────────────────────────

function parseSkillMd(
  dir: string,
  dirName: string,
  agentId: string,
): SkillInfo | null {
  // Check for enabled/disabled state
  const mdPath = join(dir, "SKILL.md");
  const disabledPath = join(dir, "SKILL.md.disabled");

  const enabled = existsSync(mdPath);
  const readPath = enabled ? mdPath : disabledPath;

  if (!existsSync(readPath)) return null;

  try {
    const content = readFileSync(readPath, "utf-8");
    const frontmatter = parseFrontmatter(content);

    return {
      id: dirName,
      name: frontmatter.name ?? dirName,
      description: frontmatter.description ?? "",
      agentId,
      path: dir,
      enabled,
    };
  } catch {
    return {
      id: dirName,
      name: dirName,
      description: "",
      agentId,
      path: dir,
      enabled,
    };
  }
}

// ── Frontmatter parser ────────────────────────────────────
// Lightweight YAML-like key: value extraction.
// Avoids adding a full YAML parser dependency.

function parseFrontmatter(
  content: string,
): Record<string, string> {
  const result: Record<string, string> = {};

  // Extract content between --- delimiters
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;

  const fm = match[1];
  const lines = fm.split("\n");
  let currentKey = "";
  let currentValue = "";

  for (const line of lines) {
    const keyMatch = line.match(/^(\w[\w-]*):\s?(.*)/);
    if (keyMatch) {
      // Save previous key-value
      if (currentKey) {
        result[currentKey] = currentValue.trim();
      }
      currentKey = keyMatch[1];
      currentValue = keyMatch[2] ?? "";
    } else if (currentKey && (line.startsWith("  ") || line.startsWith("\t"))) {
      // Continuation of previous value (multi-line with indent)
      currentValue += " " + line.trim();
    }
  }
  // Save last key-value
  if (currentKey) {
    result[currentKey] = currentValue.trim();
  }

  return result;
}
