import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type {
  FileContent,
  HomepageFileMeta,
  HistoryEntry,
  SaveFileResponse,
  SetupState,
  StatusResponse,
} from "@homepage-manager/shared";
import { classify, isEditableName } from "./classify";
import { createWatcher } from "./watcher";
import {
  isSafeRelPath,
  resolveReadPath,
  resolveWritePath,
  SandboxError,
} from "./sandbox";
import { validateContent } from "./validate";
import { HistoryStore } from "./history";
import { SettingsStore } from "./settings";

export interface WatchSink {
  emit: (relPath: string, event: "add" | "change" | "unlink") => void;
  rewatchAll: () => void;
}

export class Manager {
  private readonly settingsStore: SettingsStore;
  private readonly historyStore: HistoryStore;
  private configDir: string | undefined;
  private sink?: WatchSink;

  constructor(dataDir: string) {
    this.settingsStore = new SettingsStore(dataDir);
    this.historyStore = new HistoryStore(dataDir);
  }

  attachSink(sink: WatchSink): void {
    this.sink = sink;
  }

  async init(): Promise<void> {
    const settings = await this.settingsStore.load();
    this.configDir = settings.configDir;
    if (this.configDir) {
      await this.tryWatch();
    }
  }

  private getConfigDir(): string {
    if (!this.configDir) {
      throw new SandboxError(
        "No Homepage configuration directory configured yet. Run setup first.",
        "NOT_CONFIGURED"
      );
    }
    return this.configDir;
  }

  private get configSet(): boolean {
    return Boolean(this.configDir);
  }

  setupState(): SetupState {
    return { configured: this.configSet, configDir: this.configDir };
  }

  private hashOf(content: string): string {
    return createHash("sha1").update(content).digest("hex");
  }

  async status(): Promise<StatusResponse> {
    const setup = this.setupState();
    const dir = this.configDir;
    if (!dir) {
      return { setup };
    }
    let exists = false;
    let writable = false;
    let message: string | undefined;
    try {
      const st = await fs.stat(dir);
      exists = st.isDirectory();
      if (!exists) {
        message = "The configured path is not a directory.";
      }
    } catch {
      exists = false;
      message = "The configured directory does not exist on this host.";
    }
    if (exists) {
      try {
        const probe = path.join(dir, `.hpm-write-test-${process.pid}`);
        await fs.writeFile(probe, "ok", "utf8");
        await fs.unlink(probe);
        writable = true;
      } catch {
        writable = false;
        message =
          "The configured directory is not writable by this process. Check permissions / UID / GID.";
      }
    }

    const files = this.configSet && exists ? await this.listFilesSafe() : [];
    return {
      setup,
      exists,
      writable,
      message,
      files,
      fileCount: files.length,
    };
  }

  private async listFilesSafe(): Promise<HomepageFileMeta[]> {
    const root = this.configDir!;
    const rootReal = await fs.realpath(root);
    const out: HomepageFileMeta[] = [];
    await this.walk(rootReal, "", out, 4);
    return out;
  }

  private async walk(
    dirAbs: string,
    relDir: string,
    out: HomepageFileMeta[],
    depth: number
  ): Promise<void> {
    if (depth < 0) return;
    let entries;
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    // Deterministic ordering.
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const abs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        await this.walk(abs, relDir ? `${relDir}/${entry.name}` : entry.name, out, depth - 1);
      } else if (entry.isFile() && isEditableName(entry.name)) {
        try {
          const meta = await this.metaFor(abs, relDir, entry.name);
          out.push(meta);
        } catch {
          // Skip files we cannot stat/read.
        }
      }
    }
  }

  private async metaFor(
    abs: string,
    relDir: string,
    name: string
  ): Promise<HomepageFileMeta> {
    const stat = await fs.stat(abs);
    const rel = relDir ? `${relDir}/${name}` : name;
    const { kind, language, group } = classify(rel);
    let hash = "";
    try {
      const content = await fs.readFile(abs, "utf8");
      hash = this.hashOf(content);
    } catch {
      hash = "";
    }
    return {
      path: rel,
      name,
      dir: relDir,
      kind,
      language,
      group,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      hash,
    };
  }

  async readFile(rel: string): Promise<FileContent> {
    const root = this.getConfigDir();
    const segments = rel.split("/");
    const name = segments[segments.length - 1];
    const relDir = segments.slice(0, -1).join("/");
    if (!isEditableName(name)) {
      throw new SandboxError(
        `Files of this type are not editable. Allowed: .yaml, .yml, .css, .js`,
        "NOT_ALLOWED"
      );
    }
    const real = await resolveReadPath(root, rel);
    const content = await fs.readFile(real, "utf8");
    const stat = await fs.stat(real);
    const { kind, language, group } = classify(rel);
    return {
      path: rel,
      name,
      dir: relDir,
      kind,
      language,
      group,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      hash: this.hashOf(content),
      content,
    };
  }

  /** YAML validation gate used by the "Validate" action. */
  validate(content: string, language: string) {
    return validateContent(content, language as never);
  }

  async saveFile(
    rel: string,
    content: string,
    expectedHash?: string,
    force = false
  ): Promise<SaveFileResponse> {
    const root = this.getConfigDir();
    if (!isSafeRelPath(rel)) {
      throw new SandboxError("Unsafe path.", "INVALID_PATH");
    }
    const { language } = classify(rel);
    if (language === "yaml") {
      const res = this.validate(content, language);
      if (!res.valid) {
        throw new SandboxError(
          res.issues[0]?.message ?? "The YAML does not parse.",
          "YAML_INVALID"
        );
      }
    }
    const real = await resolveWritePath(root, rel);
    const currentContent = await fs.readFile(real, "utf8");
    const currentHash = this.hashOf(currentContent);

    if (!force && expectedHash !== undefined && expectedHash !== currentHash) {
      return {
        ok: false,
        conflict: true,
        path: rel,
        hash: currentHash,
        mtime: (await fs.stat(real)).mtime.toISOString(),
        currentContent,
        currentHash,
      };
    }

    // Snapshot the previous content into version history before overwriting.
    await this.historyStore.record(rel, currentContent);

    const tmp = `${real}.${process.pid}.${Date.now()}.hpm.tmp`;
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, real);

    const newContent = await fs.readFile(real, "utf8");
    const newHash = this.hashOf(newContent);
    return {
      ok: true,
      path: rel,
      hash: newHash,
      mtime: (await fs.stat(real)).mtime.toISOString(),
    };
  }

  async listHistory(rel: string): Promise<HistoryEntry[]> {
    this.getConfigDir();
    if (!isSafeRelPath(rel)) {
      throw new SandboxError("Unsafe path.", "INVALID_PATH");
    }
    await resolveReadPath(this.configDir!, rel);
    return this.historyStore.list(rel);
  }

  async getHistoryItem(
    rel: string,
    id: string
  ): Promise<{ content: string; entry: HistoryEntry } | null> {
    this.getConfigDir();
    if (!isSafeRelPath(rel)) {
      throw new SandboxError("Unsafe path.", "INVALID_PATH");
    }
    await resolveReadPath(this.configDir!, rel);
    return this.historyStore.get(rel, id);
  }

  async restore(
    rel: string,
    id: string,
    expectedHash?: string
  ): Promise<SaveFileResponse> {
    const root = this.getConfigDir();
    if (!isSafeRelPath(rel)) {
      throw new SandboxError("Unsafe path.", "INVALID_PATH");
    }
    const item = await this.historyStore.get(rel, id);
    if (!item) {
      throw new SandboxError("That version no longer exists.", "NOT_FOUND");
    }
    const real = await resolveWritePath(root, rel);
    const currentContent = await fs.readFile(real, "utf8");
    const currentHash = this.hashOf(currentContent);
    if (expectedHash !== undefined && expectedHash !== currentHash) {
      return {
        ok: false,
        conflict: true,
        path: rel,
        hash: currentHash,
        mtime: (await fs.stat(real)).mtime.toISOString(),
        currentContent,
        currentHash,
      };
    }
    // The current content becomes a new snapshot too.
    await this.historyStore.record(rel, currentContent);
    const tmp = `${real}.${process.pid}.${Date.now()}.hpm.tmp`;
    await fs.writeFile(tmp, item.content, "utf8");
    await fs.rename(tmp, real);
    const saved = await this.readFile(rel);
    return { ok: true, path: rel, hash: saved.hash, mtime: saved.mtime };
  }

  /** Try to set up watching on configDir. */
  private watcher?: { close: () => Promise<void> };

  async tryWatch(): Promise<void> {
    const dir = this.configDir;
    if (!dir) return;
    let exists = false;
    try {
      exists = (await fs.stat(dir)).isDirectory();
    } catch {
      exists = false;
    }
    if (!exists) return;
    try {
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = undefined;
      }
      this.watcher = await createWatcher(dir, (p, ev) => {
        this.sink?.emit(p, ev);
      });
    } catch (err) {
      // Watching is best-effort; the app keeps working without it.
      // eslint-disable-next-line no-console
      console.error("Failed to start filesystem watcher:", err);
    }
  }

  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }

  async setConfigDir(next: string): Promise<SetupState> {
    const root = path.resolve(next);
    let st;
    try {
      st = await fs.stat(root);
    } catch {
      throw new SandboxError(
        `The path "${root}" does not exist.`,
        "NOT_FOUND"
      );
    }
    if (!st.isDirectory()) {
      throw new SandboxError(
        `The path "${root}" is not a directory.`,
        "NOT_A_DIRECTORY"
      );
    }
    const real = await fs.realpath(root);
    // Verify read+write access before accepting the directory.
    const probe = path.join(real, `.hpm-setup-test-${process.pid}`);
    try {
      await fs.writeFile(probe, "ok", "utf8");
      await fs.unlink(probe);
    } catch {
      throw new SandboxError(
        `The directory "${root}" is not writable by this process. Check permissions / UID / GID.`,
        "PERMISSION"
      );
    }
    this.configDir = real;
    await this.settingsStore.save({ configDir: real });
    await this.tryWatch();
    this.sink?.rewatchAll();
    return this.setupState();
  }

  async forgetConfig(): Promise<void> {
    await this.close();
    this.configDir = undefined;
    await this.settingsStore.save({});
    this.sink?.rewatchAll();
  }
}
