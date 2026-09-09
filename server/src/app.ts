import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import { Server } from "ws";
import path from "node:path";
import fs from "node:fs";
import { URL } from "node:url";
import type http from "node:http";
import type {
  HistoryItemResponse,
  HistoryResponse,
  RestoreRequest,
  SaveFileRequest,
  SaveFileResponse,
  SetupRequest,
  ValidateRequest,
  WatchEvent,
} from "@homepage-manager/shared";
import { Manager, type WatchSink } from "./manager";
import { SandboxError } from "./sandbox";

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

export interface AppHandlers {
  manager: Manager;
  /** HTTP routes + static web hosting. */
  app: Express;
  /** Attach websocket upgrades to an HTTP server. */
  attachWs: (server: http.Server) => void;
}

export function buildApp(dataDir: string, isDev: boolean): AppHandlers {
  const manager = new Manager(dataDir);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "20mb" }));

  const clients = new Set<import("ws").WebSocket>();
  const wsPathPrefix = "/ws";

  const watchSink: WatchSink = {
    emit: (rel, event) => {
      const msg: WatchEvent = { type: "change", path: rel, event };
      broadcast(msg);
    },
    rewatchAll: () => {
      broadcast({ type: "reconfigured" } satisfies WatchEvent);
    },
  };
  manager.attachSink(watchSink);

  function broadcast(msg: WatchEvent) {
    const text = JSON.stringify(msg);
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(text);
      }
    }
  }

  // ---------- API routes ----------

  app.get("/api/status", async (_req: Request, res: Response) => {
    const status = await manager.status();
    res.json(status);
  });

  app.post("/api/setup", async (req: Request, res: Response) => {
    const body = req.body as SetupRequest;
    if (!body || typeof body.configDir !== "string" || !body.configDir.trim()) {
      res.status(400).json({
        error: "A configuration directory path is required.",
        code: "BAD_REQUEST",
      });
      return;
    }
    try {
      const state = await manager.setConfigDir(body.configDir.trim());
      res.json(state);
    } catch (err) {
      handleError(res, err);
    }
  });

  app.delete("/api/setup", async (_req, res) => {
    await manager.forgetConfig();
    res.json({ ok: true });
  });

  app.get("/api/files", async (_req, res) => {
    try {
      const status = await manager.status();
      if (!status.setup.configured) {
        res.status(409).json({
          error: "Setup required.",
          code: "NOT_CONFIGURED",
        });
        return;
      }
      if (!status.exists) {
        res.status(503).json({ error: status.message ?? "Configuration directory unavailable.", code: "UNAVAILABLE" });
        return;
      }
      // Listing remains available on read-only mounts so every file can report
      // its own Read/Write capability instead of disappearing from the browser.
      res.json(status.files ?? []);
    } catch (err) {
      handleError(res, err);
    }
  });

  app.post(
    "/api/files/*/save",
    async (req: Request, res: Response) => {
      const rel = toPosix(req.params[0]);
      const body = req.body as SaveFileRequest;
      if (!body || typeof body.content !== "string") {
        res.status(400).json({ error: "Missing content.", code: "BAD_REQUEST" });
        return;
      }
      try {
        const result: SaveFileResponse = await manager.saveFile(
          rel,
          body.content,
          typeof body.expectedHash === "string" ? body.expectedHash : undefined,
          body.force === true
        );
        if (!result.ok) {
          res.status(409).json({ ...result });
          return;
        }
        res.json(result);
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  app.post("/api/validate", async (req: Request, res: Response) => {
    const body = req.body as ValidateRequest;
    if (!body || typeof body.content !== "string") {
      res.status(400).json({ error: "Missing content.", code: "BAD_REQUEST" });
      return;
    }
    const language = (body.language ?? "yaml") as ValidateRequest["language"];
    const result = manager.validate(body.content, language);
    res.json(result);
  });

  app.get("/api/files/*/history", async (req: Request, res: Response) => {
    const rel = toPosix(req.params[0]);
    try {
      const entries = await manager.listHistory(rel);
      const body: HistoryResponse = { path: rel, entries };
      res.json(body);
    } catch (err) {
      handleError(res, err);
    }
  });

  app.get(
    "/api/files/*/history/:id",
    async (req: Request, res: Response) => {
      const rel = toPosix(req.params[0]);
      const id = req.params.id;
      try {
        const item = await manager.getHistoryItem(rel, id);
        if (!item) {
          res.status(404).json({
            error: "That version no longer exists.",
            code: "NOT_FOUND",
          });
          return;
        }
        const body: HistoryItemResponse = {
          id: item.entry.id,
          path: rel,
          content: item.content,
          createdAt: item.entry.createdAt,
          hash: item.entry.hash,
        };
        res.json(body);
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  app.post(
    "/api/files/*/restore/:id",
    async (req: Request, res: Response) => {
      const rel = toPosix(req.params[0]);
      const id = req.params.id;
      const body = (req.body ?? {}) as RestoreRequest;
      try {
        const result = await manager.restore(
          rel,
          id,
          typeof body.expectedHash === "string" ? body.expectedHash : undefined
        );
        if (!result.ok) {
          res.status(409).json({ ...result });
          return;
        }
        res.json(result);
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // Generic read route — registered LAST so the more specific
  // `/api/files/*/history` GET routes above win.
  app.get("/api/files/*", async (req: Request, res: Response) => {
    const rel = toPosix(req.params[0]);
    try {
      const file = await manager.readFile(rel);
      res.json(file);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------- Static web hosting ----------

  // Resolve the web dist directory from a location that works in dev (source)
  // and after `vite build` (web/dist).
  const candidates = isDev
    ? []
    : [
        path.resolve(process.cwd(), "web/dist"),
        path.resolve(process.cwd(), "dist"),
      ];

  if (!isDev) {
    const webDist = candidates.find((c) => {
      try {
        return fs.statSync(c).isDirectory();
      } catch {
        return false;
      }
    });

    if (webDist) {
      const staticDir = path.resolve(webDist);
      app.use(express.static(staticDir));
      // SPA fallback for client-side routing.
      app.get(/^\/(?!api|ws).*/, (_req, res) => {
        res.sendFile(path.join(staticDir, "index.html"));
      });
    }
  }

  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: NextFunction
    ) => {
      handleError(res, err);
    }
  );

  // ---------- WebSocket ----------

  const attachWs = (server: http.Server): void => {
    const wss = new Server({ noServer: true });
    server.on(
      "upgrade",
      (req: http.IncomingMessage, socket: import("stream").Duplex, head: Buffer) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === wsPathPrefix) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        } else {
          socket.destroy();
        }
      }
    );
    wss.on("connection", (ws) => {
      clients.add(ws);
      ws.on("close", () => clients.delete(ws));
      ws.on("error", () => clients.delete(ws));
    });
  };

  return { manager, app, attachWs };
}

function handleError(res: Response, err: unknown) {
  if (err instanceof SandboxError) {
    res.status(err.code === "NOT_FOUND" || err.code === "NOT_A_FILE" ? 404 : 400).json({
      error: err.message,
      code: err.code,
    });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON body.", code: "BAD_JSON" });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Internal server error.", code: "INTERNAL" });
}
