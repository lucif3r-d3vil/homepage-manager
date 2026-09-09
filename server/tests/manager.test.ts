import { describe, expect, it, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { makeTempEnv, cleanup, seedHomepage, type TempEnv } from "./helpers";
import { Manager } from "../src/manager";
import { SandboxError } from "../src/sandbox";

describe("Manager", () => {
  let env: TempEnv;
  let manager: Manager;

  beforeAll(async () => {
    env = await makeTempEnv();
    manager = new Manager(env.dataDir);
  });

  afterAll(async () => {
    await manager.close();
    await cleanup(env);
  });

  it("is unconfigured initially", async () => {
    const st = await manager.status();
    expect(st.setup.configured).toBe(false);
  });

  it("refuses to set a non-existent directory", async () => {
    await expect(
      manager.setConfigDir(path.join(env.root, "nope"))
    ).rejects.toThrow(SandboxError);
  });

  it("refuses to set a file as the config dir", async () => {
    const f = path.join(env.root, "afile");
    await fs.writeFile(f, "x", "utf8");
    await expect(manager.setConfigDir(f)).rejects.toThrow(SandboxError);
  });

  it("detects and lists Homepage files after setup", async () => {
    await seedHomepage(env.configDir);
    await manager.setConfigDir(env.configDir);
    const st = await manager.status();
    expect(st.setup.configured).toBe(true);
    expect(st.exists).toBe(true);
    expect(st.writable).toBe(true);
    const names = (st.files ?? []).map((f) => f.name).sort();
    expect(names).toEqual(
      ["bookmarks.yaml", "custom.css", "custom.js", "services.yaml", "settings.yaml", "widgets.yaml"].sort()
    );
  });

  it("classifies files into groups", async () => {
    const files = (await manager.status()).files ?? [];
    const by = (n: string) => files.find((f) => f.name === n)?.group;
    expect(by("services.yaml")).toBe("Services");
    expect(by("bookmarks.yaml")).toBe("Bookmarks");
    expect(by("settings.yaml")).toBe("Settings");
    expect(by("widgets.yaml")).toBe("Widgets");
    expect(by("custom.css")).toBe("Custom CSS");
    expect(by("custom.js")).toBe("Custom JS");
  });

  it("reads a file and rejects traversal reads", async () => {
    const f = await manager.readFile("services.yaml");
    expect(f.content).toContain("My Service");
    expect(f.language).toBe("yaml");
    await expect(manager.readFile("../settings.yaml")).rejects.toThrow(
      SandboxError
    );
  });

  it("blocks non-editable extensions", async () => {
    await fs.writeFile(path.join(env.configDir, "notes.md"), "hi", "utf8");
    await expect(manager.readFile("notes.md")).rejects.toThrow(SandboxError);
  });

  it("blocks invalid YAML from being saved", async () => {
    await expect(
      manager.saveFile("services.yaml", "a:\n  bad: [\n", undefined, true)
    ).rejects.toThrow(SandboxError);
  });

  it("saves a file and reflects the change on disk", async () => {
    const before = await manager.readFile("services.yaml");
    const newContent = before.content + "\n# appended by test\n";
    const res = await manager.saveFile("services.yaml", newContent, before.hash);
    expect(res.ok).toBe(true);
    const onDisk = await fs.readFile(
      path.join(env.configDir, "services.yaml"),
      "utf8"
    );
    expect(onDisk).toBe(newContent);
    const reread = await manager.readFile("services.yaml");
    expect(reread.content).toBe(newContent);
  });

  it("reports a conflict instead of overwriting silently", async () => {
    const before = await manager.readFile("bookmarks.yaml");
    // Simulate an external change after the client last saw the file.
    const external = before.content + "\n# external\n";
    await manager.saveFile("bookmarks.yaml", external, before.hash, true);
    // Now the client tries to save its (stale) edit with the old expected hash.
    const staleHash = before.hash;
    const res = await manager.saveFile(
      "bookmarks.yaml",
      "client edit",
      staleHash,
      false
    );
    expect(res.ok).toBe(false);
    expect(res.conflict).toBe(true);
    expect(res.currentContent).toContain("external");
    // force overwrite still works (explicit user action)
    const forced = await manager.saveFile(
      "bookmarks.yaml",
      "client wins",
      staleHash,
      true
    );
    expect(forced.ok).toBe(true);
  });

  it("records version history and restores it", async () => {
    const f0 = await manager.readFile("widgets.yaml");
    const v0hash = f0.hash;

    const v1 = f0.content + "\n# revision one\n";
    const r1 = await manager.saveFile("widgets.yaml", v1, f0.hash);
    const v2 = f0.content + "\n# revision two\n";
    const r2 = await manager.saveFile("widgets.yaml", v2, r1.hash);

    const history = await manager.listHistory("widgets.yaml");
    // Two snapshots recorded: the pre-v1 and pre-v2 contents.
    expect(history.length).toBeGreaterThanOrEqual(2);

    const entry = history.find((h) => h.hash === v0hash);
    expect(entry).toBeDefined();
    const item = await manager.getHistoryItem("widgets.yaml", entry!.id);
    expect(item?.content).toContain("openweathermap");

    // Restore the original content (optimistic expected hash = current disk hash).
    const restored = await manager.restore("widgets.yaml", entry!.id, r2.hash);
    expect(restored.ok).toBe(true);
    const reread = await manager.readFile("widgets.yaml");
    expect(reread.content).toContain("{{HOMEPAGE_VAR_WEATHER_API_KEY}}");
    expect(reread.hash).toBe(v0hash);
  });
});
