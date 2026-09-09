/**
 * Filesystem watcher built on chokidar.
 *
 * Only emits events for editable files (.yaml/.yml/.css/.js). We re-derive the
 * relative path against the watched root so the client never sees absolute paths.
 */

import chokidar from "chokidar";
import { isEditableName } from "./classify";

export interface WatcherHandle {
  close: () => Promise<void>;
}

export async function createWatcher(
  root: string,
  onEvent: (relPath: string, event: "add" | "change" | "unlink") => void
): Promise<WatcherHandle> {
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    depth: 4,
    followSymlinks: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 60,
    },
    ignored: (p) => {
      const base = p.split("/").pop() ?? p;
      if (base === ".git") return true;
      return false;
    },
  });

  const filterAndEmit = (p: string, event: "add" | "change" | "unlink") => {
    const name = p.split(/[\\/]/).pop() ?? p;
    if (!isEditableName(name)) return;
    // Guard: only emit if inside root.
    if (!p.startsWith(root)) return;
    let rel = p.slice(root.length).replace(/^[\\/]+/, "");
    // Normalize backslashes for windows roots.
    rel = rel.replace(/\\/g, "/");
    if (!rel) return;
    onEvent(rel, event);
  };

  watcher.on("add", (p) => filterAndEmit(p, "add"));
  watcher.on("change", (p) => filterAndEmit(p, "change"));
  watcher.on("unlink", (p) => filterAndEmit(p, "unlink"));
  watcher.on("addDir", () => undefined);
  watcher.on("unlinkDir", () => undefined);

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => resolve(), 2000);
    watcher.once("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
    watcher.once("ready", () => {
      clearTimeout(t);
      resolve();
    });
  });

  return {
    async close() {
      await watcher.close();
    },
  };
}
