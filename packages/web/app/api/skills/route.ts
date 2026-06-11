import { NextRequest, NextResponse } from "next/server";
import { scanSkills, clearSkillsCache } from "@/lib/skills/scanner";
import { searchMarketplace } from "@/lib/skills";
import { renameSync, existsSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SKILL_DIRS: Record<string, string> = {
  pi: join(homedir(), ".pi", "agent", "skills"),
};

// GET /api/skills?agent=pi — list installed skills
// GET /api/skills?q=frontend&agent=pi — search marketplace
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const agent = url.searchParams.get("agent") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  if (q) {
    // Filter out already-installed skills
    const installed = new Set<string>();
    if (agent) {
      const results = scanSkills(agent);
      for (const r of results) {
        for (const s of r.skills) installed.add(s.id);
      }
    }
    const results = searchMarketplace(q).filter((s) => !installed.has(s.id));
    return NextResponse.json({ marketplace: results });
  }

  const results = scanSkills(agent);
  return NextResponse.json({ results });
}

// POST /api/skills — action dispatcher
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "toggle";

    if (action === "install") return handleInstall(body);
    return handleToggle(body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Action failed" },
      { status: 500 },
    );
  }
}

// ── Toggle ──────────────────────────────────────────────────
async function handleToggle(body: { agentId: string; skillId: string; enabled: boolean }) {
  const { agentId, skillId, enabled } = body;

  if (!agentId || !skillId) {
    return NextResponse.json({ error: "agentId and skillId required" }, { status: 400 });
  }

  const results = scanSkills(agentId);
  const agentSkills = results.find((r) => r.agentId === agentId);
  const skill = agentSkills?.skills.find((s) => s.id === skillId);

  if (!skill) {
    return NextResponse.json({ error: `Skill not found: ${skillId}` }, { status: 404 });
  }

  const mdPath = join(skill.path, "SKILL.md");
  const disabledPath = join(skill.path, "SKILL.md.disabled");

  if (enabled && existsSync(disabledPath)) {
    renameSync(disabledPath, mdPath);
  } else if (!enabled && existsSync(mdPath)) {
    renameSync(mdPath, disabledPath);
  }

  clearSkillsCache();
  return NextResponse.json({ ok: true, skillId, enabled });
}

// ── Install ─────────────────────────────────────────────────
async function handleInstall(body: {
  agentId: string;
  skillId: string;
  name: string;
  description: string;
  source: string;
}) {
  const { agentId, skillId, name, description, source } = body;

  if (!agentId || !skillId) {
    return NextResponse.json({ error: "agentId and skillId required" }, { status: 400 });
  }

  const skillsDir = SKILL_DIRS[agentId];
  if (!skillsDir) {
    return NextResponse.json({ error: `Unknown agent: ${agentId}` }, { status: 400 });
  }

  const destDir = join(skillsDir, skillId);

  // Try to copy from source if available (e.g. superpowers plugin)
  const sourceDir = findSourceDir(skillId);
  if (sourceDir) {
    mkdirSync(destDir, { recursive: true });
    cpSync(sourceDir, destDir, { recursive: true });
  } else {
    // Create minimal SKILL.md from marketplace metadata
    mkdirSync(destDir, { recursive: true });
    const md = [
      "---",
      `name: ${name}`,
      `description: ${description}`,
      `source: ${source}`,
      "---",
      "",
      `# ${name}`,
      "",
      description,
      "",
      `Source: ${source}`,
    ].join("\n");
    writeFileSync(join(destDir, "SKILL.md"), md, "utf-8");
  }

  clearSkillsCache();
  return NextResponse.json({ ok: true, skillId, installed: true });
}

// ── Helpers ─────────────────────────────────────────────────
function findSourceDir(skillId: string): string | null {
  // Check Pi skills directory for already-installed skills
  const piSkills = join(homedir(), ".pi", "agent", "skills", skillId);
  if (existsSync(piSkills)) return piSkills;
  return null;
}
