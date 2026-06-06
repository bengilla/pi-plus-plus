export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  agentId: string;
  path: string;
  enabled: boolean;
}

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  /** npm package or GitHub repo */
  source: string;
  /** Compatible agents */
  agents: string[];
}

export interface SkillsResult {
  agentId: string;
  skills: SkillInfo[];
}
