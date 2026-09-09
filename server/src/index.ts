import http from "node:http";
import fs from "node:fs/promises";
import { buildApp } from "./app";
import { resolveDataDir } from "./settings";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const IS_DEV = process.env.NODE_ENV !== "production";

async function ensureDataDir(): Promise<string> {
  const dir = resolveDataDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function main() {
  const dataDir = await ensureDataDir();
  const { app, attachWs, manager } = buildApp(dataDir, IS_DEV);

  await manager.init();

  const server = http.createServer(app);
  attachWs(server);

  server.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[homepage-manager] listening on http://${HOST}:${PORT} (${IS_DEV ? "dev" : "production"})`
    );
    // eslint-disable-next-line no-console
    console.log(`[homepage-manager] application data directory: ${dataDir}`);
  });

  const shutdown = async () => {
    await manager.close();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start homepage-manager:", err);
  process.exit(1);
});
