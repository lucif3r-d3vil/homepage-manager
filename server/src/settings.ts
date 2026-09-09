/**
 * Persistent application state: the application's own data directory and the
 * small settings document (currently just the configured Homepage config dir).
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface AppSettings {
  configDir?: string;
}

function env(): string | undefined {
  return process.env.HOMEPAGE_MANAGER_DATA_DIR ?? process.env.DATA_DIR;
}

export function resolveDataDir(): string {
  const given = env();
  if (given) {
    return path.resolve(given);
  }
  return path.resolve(process.cwd(), "data");
}

export class SettingsStore {
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, "settings.json");
  }

  async load(): Promise<AppSettings> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as AppSettings;
      return {
        configDir:
          typeof parsed.configDir === "string" ? parsed.configDir : undefined,
      };
    } catch {
      return {};
    }
  }

  async save(settings: AppSettings): Promise<void> {
    const dir = path.dirname(this.file);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(settings, null, 2), "utf8");
    await fs.rename(tmp, this.file);
  }
}
