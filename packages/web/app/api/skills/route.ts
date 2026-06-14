import { NextRequest, NextResponse } from "next/server";
import { scanSkills, clearSkillsCache, getProjectSkills, setProjectSkills, SKILL_DIR } from "@/lib/skills/scanner";
import { renameSync, existsSync, mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

// ── API ──────────────────────────────────────────────────────

// GET /api/skills?workspace=X — list installed skills + per-project enabled state
export async function GET(req: NextRequest) {
  const workspace = new URL(req.url).searchParams.get("workspace") ?? undefined;

  const skills = scanSkills();

  // If workspace provided, add per-project enabled state
  let projectSkills: string[] = [];
  let hasProjectConfig = false;
  if (workspace) {
    const config = getProjectSkills(workspace);
    projectSkills = config.skills;
    hasProjectConfig = config.hasConfig;
  }

  const augmented = skills.map((s) => ({
    ...s,
    projectEnabled: hasProjectConfig ? projectSkills.includes(s.id) : null,
  }));

  return NextResponse.json({ skills: augmented, hasProjectConfig });
}

// POST /api/skills — action dispatcher
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: string = body.action ?? "toggle";

    switch (action) {
      case "install": return handleInstall(body);
      case "delete": return handleDelete(body);
      case "update": return handleUpdate(body);
      case "project-toggle": return handleProjectToggle(body);
      default: return handleToggle(body);
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Action failed" },
      { status: 500 },
    );
  }
}

// ── Toggle (global enable/disable via rename) ──────────────────

async function handleToggle(body: { skillId: string; enabled: boolean }) {
  const { skillId, enabled } = body;
  if (!skillId) return NextResponse.json({ error: "skillId required" }, { status: 400 });

  const skill = scanSkills().find((s) => s.id === skillId);
  if (!skill) return NextResponse.json({ error: `Skill not found: ${skillId}` }, { status: 404 });

  const mdPath = join(skill.path, "SKILL.md");
  const disabledPath = join(skill.path, "SKILL.md.disabled");

  if (enabled && existsSync(disabledPath)) renameSync(disabledPath, mdPath);
  else if (!enabled && existsSync(mdPath)) renameSync(mdPath, disabledPath);

  clearSkillsCache();
  return NextResponse.json({ ok: true, skillId, enabled });
}

// ── Install (git clone or stub) ───────────────────────────────

async function handleInstall(body: {
  skillId: string;
  name?: string;
  description?: string;
  source?: string;
}) {
  const { skillId, name, description, source } = body;
  if (!skillId) return NextResponse.json({ error: "skillId required" }, { status: 400 });

  const destDir = join(SKILL_DIR, skillId);

  // Strategy 1: GitHub repo URL → git clone
  if (source && isRepoUrl(source)) {
    return installFromGitHub(source, destDir, skillId);
  }

  // Strategy 2: Copy from existing source directory
  const sourceDir = findSourceDir(skillId);
  if (sourceDir) {
    mkdirSync(destDir, { recursive: true });
    cpSync(sourceDir, destDir, { recursive: true });
    clearSkillsCache();
    return NextResponse.json({ ok: true, skillId, installed: true });
  }

  // Strategy 3: Stub SKILL.md (URL install fallback)
  if (!name || !description) {
    return NextResponse.json({ error: "name and description required" }, { status: 400 });
  }

  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "SKILL.md"), [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    `source: ${source ?? "manual"}`,
    "---",
    "",
    `# ${name}`,
    "",
    description,
  ].join("\n"), "utf-8");

  clearSkillsCache();
  return NextResponse.json({ ok: true, skillId, installed: true });
}

// ── Install helpers ───────────────────────────────────────────

function isRepoUrl(url: string): boolean {
  return /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url);
}

function findSourceDir(skillId: string): string | null {
  const dir = join(SKILL_DIR, skillId);
  return existsSync(dir) ? dir : null;
}

async function installFromGitHub(url: string, destDir: string, skillId: string): Promise<NextResponse> {
  try { rmSync(destDir, { recursive: true }); } catch { /* not exists */ }
  mkdirSync(destDir, { recursive: true });

  try {
    execSync(`git clone --depth=1 "${url}.git" "${destDir}"`, { stdio: "pipe", timeout: 30_000 });
  } catch (e: unknown) {
    try { rmSync(destDir, { recursive: true }); } catch { /* ignore */ }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Git clone failed: ${msg}` }, { status: 500 });
  }

  if (!existsSync(join(destDir, "SKILL.md"))) {
    try { rmSync(destDir, { recursive: true }); } catch { /* ignore */ }
    return NextResponse.json({ error: "Repository has no SKILL.md — not a valid skill" }, { status: 400 });
  }

  clearSkillsCache();
  return NextResponse.json({ ok: true, skillId, installed: true, source: url });
}

// ── Delete ────────────────────────────────────────────────────

async function handleDelete(body: { skillId: string }) {
  const { skillId } = body;
  if (!skillId) return NextResponse.json({ error: "skillId required" }, { status: 400 });

  const destDir = join(SKILL_DIR, skillId);
  if (!existsSync(destDir)) return NextResponse.json({ error: `Skill not found: ${skillId}` }, { status: 404 });

  try {
    rmSync(destDir, { recursive: true });
    clearSkillsCache();
    return NextResponse.json({ ok: true, skillId, deleted: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 500 });
  }
}

// ── Update (git pull) ─────────────────────────────────────────

async function handleUpdate(body: { skillId: string }) {
  const { skillId } = body;
  if (!skillId) return NextResponse.json({ error: "skillId required" }, { status: 400 });

  const skillDir = join(SKILL_DIR, skillId);
  if (!existsSync(join(skillDir, ".git"))) {
    return NextResponse.json({ error: "Not a git repository — cannot update" }, { status: 400 });
  }

  try {
    const out = execSync("git pull", { cwd: skillDir, stdio: "pipe", timeout: 30_000 });
    return NextResponse.json({ ok: true, skillId, updated: true, output: out.toString().trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 500 });
  }
}

// ── Project toggle ────────────────────────────────────────────

async function handleProjectToggle(body: { skillId: string; workspace: string; enabled: boolean }) {
  const { skillId, workspace, enabled } = body;
  if (!skillId || !workspace) {
    return NextResponse.json({ error: "skillId and workspace required" }, { status: 400 });
  }

  try {
    const result = setProjectSkills(workspace, skillId, enabled);
    return NextResponse.json({ ok: true, skillId, enabled, skills: result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
