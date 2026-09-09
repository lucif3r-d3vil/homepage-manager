import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { makeTempEnv, cleanup, seedHomepage, type TempEnv } from "./helpers";
import { buildApp } from "../src/app";
import { Manager } from "../src/manager";

describe("HTTP API", () => {
  let env: TempEnv;
  let app: ReturnType<typeof buildApp>["app"];
  let manager: Manager;

  beforeAll(async () => {
    env = await makeTempEnv();
    await seedHomepage(env.configDir);
    const built = buildApp(env.dataDir, true); // isDev => no static hosting in tests
    app = built.app;
    manager = built.manager;
    await manager.init();
  });

  afterAll(async () => {
    await manager.close();
    await cleanup(env);
  });

  it("GET /api/status reports unconfigured before setup", async () => {
    const res = await request(app).get("/api/status");
    expect(res.status).toBe(200);
    expect(res.body.setup.configured).toBe(false);
  });

  it("POST /api/setup rejects a missing directory", async () => {
    const res = await request(app)
      .post("/api/setup")
      .send({ configDir: "/definitely/not/here" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("POST /api/setup validates a real directory", async () => {
    const res = await request(app)
      .post("/api/setup")
      .send({ configDir: env.configDir });
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
  });

  it("GET /api/files returns the discovered Homepage files", async () => {
    const res = await request(app).get("/api/files");
    expect(res.status).toBe(200);
    const names = (res.body as Array<{ name: string }>).map((f) => f.name);
    expect(names).toContain("services.yaml");
    expect(names).toContain("custom.js");
  });

  it("GET a file returns content + metadata", async () => {
    const res = await request(app).get("/api/files/services.yaml");
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("My Service");
    expect(res.body.language).toBe("yaml");
  });

  it("path traversal is rejected", async () => {
    const res = await request(app).get("/api/files/..%2Fsettings.yaml");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PATH_TRAVERSAL");
  });

  it("POST /api/validate catches invalid YAML", async () => {
    const res = await request(app)
      .post("/api/validate")
      .send({ content: "a:\n  - [b\n", language: "yaml" });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it("save round-trips through the API", async () => {
    const res = await request(app)
      .post("/api/files/services.yaml/save")
      .send({ content: "title: Updated API\n", force: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const read = await request(app).get("/api/files/services.yaml");
    expect(read.body.content).toBe("title: Updated API\n");
  });

  it("save returns 409 conflict on stale expected hash", async () => {
    const read = await request(app).get("/api/files/bookmarks.yaml");
    const cur = read.body.hash;
    await request(app)
      .post("/api/files/bookmarks.yaml/save")
      .send({ content: "external write\n", expectedHash: cur, force: true })
      .expect(200);
    const conflict = await request(app)
      .post("/api/files/bookmarks.yaml/save")
      .send({ content: "my stale edit\n", expectedHash: cur, force: false });
    expect(conflict.status).toBe(409);
    expect(conflict.body.conflict).toBe(true);
  });

  it("history + restore round-trips through the API", async () => {
    const first = await request(app).get("/api/files/widgets.yaml");
    const origHash = first.body.hash;
    const v1 = (first.body.content as string) + "# api version\n";
    const s1 = await request(app)
      .post("/api/files/widgets.yaml/save")
      .send({ content: v1, expectedHash: origHash, force: false })
      .expect(200);

    const hist = await request(app).get("/api/files/widgets.yaml/history");
    expect(hist.status).toBe(200);
    const entry = (hist.body.entries as Array<{ id: string; hash: string }>).find(
      (e) => e.hash === origHash
    );
    expect(entry).toBeDefined();

    const restored = await request(app)
      .post(`/api/files/widgets.yaml/restore/${entry!.id}`)
      .send({ expectedHash: s1.body.hash });
    expect(restored.status).toBe(200);
    const back = await request(app).get("/api/files/widgets.yaml");
    expect(back.body.hash).toBe(origHash);
  });

  it("DELETE /api/setup forgets the config", async () => {
    const res = await request(app).delete("/api/setup");
    expect(res.status).toBe(200);
    const st = await request(app).get("/api/status");
    expect(st.body.setup.configured).toBe(false);
  });
});
