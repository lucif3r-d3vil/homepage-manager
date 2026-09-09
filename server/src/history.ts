/**
 * Lightweight file version history.
 *
 * Before every successful API save we snapshot the *previous* content of the file
 * into the application data directory (never inside the Homepage config dir), so a
 * user can preview and restore earlier versions. Each file's history is stored as
 * a single JSON document under `<dataDir>/history/<sha1(relativePath)>.json`.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { HistoryEntry } from "@homepage-manager/shared";

const MAX_ENTRIES = 50;

interface Snapshot extends HistoryEntry {
  content: string;
}

interface HistoryDoc {
  path: string;
  entries: Snapshot[];
}

function sha1(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

function docPathFor(dataDir: string, rel: string): string {
  const key = sha1(rel);
  return path.join(dataDir, "history", "files", `${key}.json`);
}

export class HistoryStore {
  private readonly dataDir: string;
  private readonly ready: Promise<void>;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.ready = fs
      .mkdir(path.join(dataDir, "history", "files"), { recursive: true })
      .then(() => undefined);
  }

  private async readDoc(rel: string): Promise<HistoryDoc | null> {
    try {
      const raw = await fs.readFile(docPathFor(this.dataDir, rel), "utf8");
      const parsed = JSON.parse(raw) as HistoryDoc;
      return Array.isArray(parsed.entries) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async writeDoc(rel: string, doc: HistoryDoc): Promise<void> {
    const target = docPathFor(this.dataDir, rel);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(doc, null, 2), "utf8");
    await fs.rename(tmp, target);
  }

  /** Record a snapshot of the content that is about to be replaced. */
  async record(rel: string, previousContent: string): Promise<void> {
    await this.ready;
    const doc = (await this.readDoc(rel)) ?? { path: rel, entries: [] };
    const hash = sha1(previousContent);
    const last = doc.entries[0];
    // Skip redundant snapshots (identical to the most recent one).
    if (last && last.hash === hash) return;
    const id = `${Date.now()}-${hash.slice(0, 8)}`;
    const entry: Snapshot = {
      id,
      createdAt: new Date().toISOString(),
      hash,
      size: Buffer.byteLength(previousContent, "utf8"),
      content: previousContent,
    };
    doc.entries.unshift(entry);
    if (doc.entries.length > MAX_ENTRIES) {
      doc.entries.length = MAX_ENTRIES;
    }
    await this.writeDoc(rel, doc);
  }

  async list(rel: string): Promise<HistoryEntry[]> {
    await this.ready;
    const doc = await this.readDoc(rel);
    if (!doc) return [];
    return doc.entries.map(({ content: _content, ...meta }) => meta);
  }

  async get(rel: string, id: string): Promise<{ entry: HistoryEntry; content: string } | null> {
    await this.ready;
    const doc = await this.readDoc(rel);
    if (!doc) return null;
    const hit = doc.entries.find((e) => e.id === id);
    if (!hit) return null;
    return {
      entry: {
        id: hit.id,
        createdAt: hit.createdAt,
        hash: hit.hash,
        size: hit.size,
      },
      content: hit.content,
    };
  }
}
