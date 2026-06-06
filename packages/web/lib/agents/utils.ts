import { homedir } from "node:os";
import { join } from "node:path";

/** Expand ~ to home directory */
export function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return join(homedir(), p.slice(1));
  }
  return p;
}
