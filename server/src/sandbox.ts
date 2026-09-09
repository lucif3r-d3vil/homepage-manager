/**
 * Filesystem sandboxing.
 *
 * All file access the API exposes is funnelled through the helpers here. Every
 * user-supplied relative path is normalized, traversal segments rejected, and the
 * final target is `realpath`-resolved and verified to live inside the configured
 * Homepage config directory (which itself is `realpath`-resolved). This defends
 * against `../` traversal, absolute paths, and symlink escapes.
 */

import fs from "node:fs/promises";
import path from "node:path";

export class SandboxError extends Error {
  public readonly code: string;

  constructor(message: string, code = "SANDBOX") {
    super(message);
    this.name = "SandboxError";
    this.code = code;
  }
}

/** Normalize a user supplied relative path into safe posix segments. */
export function safeSegments(rel: string): string[] {
  if (typeof rel !== "string" || rel.length === 0) {
    throw new SandboxError("A file path is required.", "INVALID_PATH");
  }
  if (rel.includes("\0")) {
    throw new SandboxError("Invalid path.", "INVALID_PATH");
  }
  if (path.isAbsolute(rel) || rel.startsWith("/") || rel.startsWith("\\")) {
    throw new SandboxError("Absolute paths are not allowed.", "ABSOLUTE_PATH");
  }
  // Windows drive letters are treated as absolute-ish; reject them.
  if (/^[a-zA-Z]:/.test(rel)) {
    throw new SandboxError("Absolute paths are not allowed.", "ABSOLUTE_PATH");
  }

  // Split on both separators and filter empties / current-dir entries.
  const segments: string[] = [];
  for (const raw of rel.split(/[\\/]+/)) {
    if (raw === "" || raw === ".") continue;
    if (raw === "..") {
      throw new SandboxError(
        "Path traversal is not allowed.",
        "PATH_TRAVERSAL"
      );
    }
    segments.push(raw);
  }
  if (segments.length === 0) {
    throw new SandboxError("A file path is required.", "INVALID_PATH");
  }
  return segments;
}

export function toPosix(segments: string[]): string {
  return segments.join("/");
}

export async function realRoot(rootDir: string): Promise<string> {
  return fs.realpath(rootDir);
}

function assertInside(
  rootReal: string,
  targetReal: string,
  allowRoot = false
): void {
  const rel = path.relative(rootReal, targetReal);
  if (rel === "") {
    if (allowRoot) return;
    throw new SandboxError(
      "The path refers to the configured directory itself.",
      "ESCAPE"
    );
  }
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new SandboxError(
      "The path escapes the configured directory.",
      "ESCAPE"
    );
  }
}

/**
 * Resolve a relative path to an existing, real, *file* that sits inside root.
 * Throws SandboxError if anything is unsafe or the file is missing.
 */
export async function resolveReadPath(
  rootDir: string,
  rel: string
): Promise<string> {
  const segments = safeSegments(rel);
  const rootReal = await realRoot(rootDir);
  const candidate = path.join(rootReal, ...segments);

  let real: string;
  try {
    real = await fs.realpath(candidate);
  } catch {
    throw new SandboxError(
      `File "${rel}" does not exist inside the configured directory.`,
      "NOT_FOUND"
    );
  }
  assertInside(rootReal, real);

  const stat = await fs.stat(real);
  if (!stat.isFile()) {
    throw new SandboxError(
      `"${rel}" is not a regular file.`,
      "NOT_A_FILE"
    );
  }
  return real;
}

/**
 * Resolve a path for writing. The parent directory must already exist (and be a
 * real dir inside root); the target file may or may not yet exist. If it exists
 * it is `realpath`-checked so we never overwrite through a symlink escape.
 */
export async function resolveWritePath(
  rootDir: string,
  rel: string
): Promise<string> {
  const segments = safeSegments(rel);
  const rootReal = await realRoot(rootDir);

  const dirSegments = segments.slice(0, -1);
  const baseName = segments[segments.length - 1];

  let dirReal: string;
  try {
    dirReal = await fs.realpath(path.join(rootReal, ...dirSegments));
  } catch {
    throw new SandboxError(
      `Directory for "${rel}" does not exist inside the configured directory.`,
      "NOT_FOUND"
    );
  }
  // The immediate parent may be the root directory itself.
  assertInside(rootReal, dirReal, true);

  const candidate = path.join(dirReal, baseName);

  // If the target exists, verify it resolves to a real file inside root and is
  // not a symlink pointing elsewhere.
  try {
    const targetReal = await fs.realpath(candidate);
    assertInside(rootReal, targetReal);
    const stat = await fs.stat(targetReal);
    if (!stat.isFile()) {
      throw new SandboxError(
        `"${rel}" is not a regular file.`,
        "NOT_A_FILE"
      );
    }
    return targetReal;
  } catch (err) {
    if (err instanceof SandboxError) throw err;
    // Not found -> brand new file inside an existing directory is acceptable.
    return candidate;
  }
}

/** Roughly validate that a raw relative path is syntactically acceptable. */
export function isSafeRelPath(rel: string): boolean {
  try {
    safeSegments(rel);
    return true;
  } catch {
    return false;
  }
}
