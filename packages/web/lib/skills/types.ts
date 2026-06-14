export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  enabled: boolean;
  /** null = no project config; true/false = explicit project setting */
  projectEnabled?: boolean | null;
}
