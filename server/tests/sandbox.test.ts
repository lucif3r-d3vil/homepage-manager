import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { makeTempEnv, cleanup } from "./helpers";
import {
  safeSegments,
  resolveReadPath,
  resolveWritePath,
  SandboxError,
} from "../src/sandbox";

describe("safeSegments (path normalization)", () => {
  it("accepts plain relative paths", () => {
    expect(safeSegments("services.yaml")).toEqual(["services.yaml"]);
    expect(safeSegments("sub/folder/widgets.yaml")).toEqual([
      "sub",
      "folder",
      "widgets.yaml",
    ]);
    expect(safeSegments("././services.yaml")).toEqual(["services.yaml"]);
  });

  it("rejects traversal", () => {
    for (const bad of [
      "../etc/passwd",
      "a/../../etc",
      "..",
      "sub/../..",
    ]) {
      expect(() => safeSegments(bad)).toThrow(SandboxError);
    }
  });

  it("rejects absolute paths and drive letters", () => {
    for (const bad of ["/etc/passwd", "/home", "C:\\windows", "\\etc", "C:/x"]) {
      expect(() => safeSegments(bad)).toThrow(SandboxError);
    }
  });

  it("rejects empty and null-bytes", () => {
    expect(() => safeSegments("")).toThrow(SandboxError);
    expect(() => safeSegments("a\0b")).toThrow(SandboxError);
  });
});

describe("sandboxed path resolution", () => {
  it("blocks escaping via symlink", async () => {
    const env = await makeTempEnv();
    try {
      const outsideSecret = path.join(env.root, "secret.txt");
      await fs.writeFile(outsideSecret, "top-secret", "utf8");
      // A symlink inside the config dir pointing outside it.
      await fs.symlink(outsideSecret, path.join(env.configDir, "leak.txt"));
      await expect(
        resolveReadPath(env.configDir, "leak.txt")
      ).rejects.toThrow(SandboxError);
    } finally {
      await cleanup(env);
    }
  });

  it("rejects reading files that do not exist", async () => {
    const env = await makeTempEnv();
    try {
      await expect(
        resolveReadPath(env.configDir, "missing.yaml")
      ).rejects.toThrow(SandboxError);
    } finally {
      await cleanup(env);
    }
  });

  it("resolves a normal file inside root", async () => {
    const env = await makeTempEnv();
    try {
      await fs.writeFile(path.join(env.configDir, "services.yaml"), "a: b", "utf8");
      const resolved = await resolveReadPath(env.configDir, "services.yaml");
      expect(path.basename(resolved)).toBe("services.yaml");
    } finally {
      await cleanup(env);
    }
  });

  it("prevents writing through a directory symlink escape", async () => {
    const env = await makeTempEnv();
    try {
      const outsideDir = path.join(env.root, "outside");
      await fs.mkdir(outsideDir);
      await fs.symlink(outsideDir, path.join(env.configDir, "linked"));
      await expect(
        resolveWritePath(env.configDir, "linked/pwned.yaml")
      ).rejects.toThrow(SandboxError);
    } finally {
      await cleanup(env);
    }
  });
});
