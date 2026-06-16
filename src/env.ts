import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

function findEnv(startDir: string): string {
  let dir = startDir;
  while (true) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir, ".env");
}

config({ path: findEnv(process.cwd()), override: true });
