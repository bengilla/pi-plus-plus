import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type { SkillInfo } from "./types";

// ── Skill directory ──────────────────────────────────────
// Pi CLI scans both ~/.pi/agent/skills/ and ~/.agents/skills/.
// We scan both to keep app ↔ CLI bidirectional.

export const SKILL_DIR = join(homedir(), ".pi", "agent", "skills");
const ALT_SKILL_DIR = join(homedir(), ".agents", "skills");
const ALL_SKILL_DIRS = [SKILL_DIR, ALT_SKILL_DIR];

let cached: SkillInfo[] | null = null;

export function clearSkillsCache(): void {
  cached = null;
}

// ── Scan ──────────────────────────────────────────────────

export function scanSkills(): SkillInfo[] {
  if (cached) return cached;

  const skills: SkillInfo[] = [];
  const seen = new Set<string>();

  for (const dir of ALL_SKILL_DIRS) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        if (seen.has(entry.name)) continue; // dedupe across dirs
        seen.add(entry.name);

        const skillDir = join(dir, entry.name);
        const parsed = parseSkillMd(skillDir, entry.name);
        if (parsed) skills.push(parsed);
      }
    } catch { /* permission errors */ }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  cached = skills;
  return skills;
}

// ── SKILL.md parser ───────────────────────────────────────

function parseSkillMd(dir: string, dirName: string): SkillInfo | null {
  const mdPath = join(dir, "SKILL.md");
  const disabledPath = join(dir, "SKILL.md.disabled");
  const enabled = existsSync(mdPath);
  const readPath = enabled ? mdPath : disabledPath;

  if (!existsSync(readPath)) return null;

  try {
    const content = readFileSync(readPath, "utf-8");
    const fm = parseFrontmatter(content);
    return {
      id: dirName,
      name: fm.name ?? dirName,
      description: fm.description ?? "",
      path: dir,
      enabled,
    };
  } catch {
    return { id: dirName, name: dirName, description: "", path: dir, enabled };
  }
}

// ── Project skills config ────────────────────────────────
// Reads/writes .pi/settings.json skills array for per-project skill filtering.
// Pi expects FULL PATHS (e.g. /Users/.../ .pi/agent/skills/pdf) in the skills array.
// The app uses skill IDs internally, so we convert between path ↔ ID at the boundary.

interface ProjectSkillsConfig {
  skills: string[];  // skill IDs
  hasConfig: boolean;
}

export function getProjectSkills(workspace: string): ProjectSkillsConfig {
  const settingsPath = join(workspace, ".pi", "settings.json");
  if (!existsSync(settingsPath)) return { skills: [], hasConfig: false };

  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const rawSkills: string[] = Array.isArray(settings.skills) ? settings.skills : [];
    const ids = rawSkills.map((s) => {
      if (s.startsWith(SKILL_DIR)) return basename(s);
      if (s.startsWith("~/.pi/agent/skills/")) return basename(s);
      return s; // pass through bare IDs
    });
    return { skills: ids, hasConfig: true };
  } catch {
    return { skills: [], hasConfig: false };
  }
}

export function setProjectSkills(
  workspace: string,
  skillId: string,
  enabled: boolean,
): string[] {
  const piDir = join(workspace, ".pi");
  const settingsPath = join(piDir, "settings.json");
  const skillPath = join(SKILL_DIR, skillId);

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, "utf-8")); } catch { settings = {}; }
  }

  const current: string[] = Array.isArray(settings.skills) ? settings.skills as string[] : [];
  const normalized = current.map((s) => {
    if (s === skillId) return skillPath;
    if (s.startsWith(SKILL_DIR) && basename(s) === skillId) return skillPath;
    return s;
  });

  const next = enabled
    ? (normalized.some((s) => s === skillPath) ? normalized : [...normalized, skillPath])
    : normalized.filter((s) => s !== skillPath);

  if (!existsSync(piDir)) mkdirSync(piDir, { recursive: true });
  settings.skills = next;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");

  return next;
}

// ── Frontmatter parser ────────────────────────────────────

function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;

  const lines = match[1].split("\n");
  let currentKey = "";
  let currentValue = "";

  for (const line of lines) {
    const keyMatch = line.match(/^(\w[\w-]*):\s?(.*)/);
    if (keyMatch) {
      if (currentKey) result[currentKey] = currentValue.trim();
      currentKey = keyMatch[1];
      currentValue = keyMatch[2] ?? "";
    } else if (currentKey && (line.startsWith("  ") || line.startsWith("\t"))) {
      currentValue += " " + line.trim();
    }
  }
  if (currentKey) result[currentKey] = currentValue.trim();
  return result;
}
