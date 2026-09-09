# 🎛️ Homepage Manager

A polished, **self-hosted** web app for editing your
[Homepage (gethomepage.dev)](https://gethomepage.dev/) dashboard configuration —
`services.yaml`, `bookmarks.yaml`, `settings.yaml`, `widgets.yaml`,
`custom.css`, `custom.js`, and any other `.yaml`/`.yml`/`.css`/`.js` files you
keep in the config folder.

Instead of SSH-ing in and hand-editing files, you get a clean, dark, glassy
editor that validates YAML, watches for external changes, never overwrites your
work silently, and keeps a lightweight version history with restore.

> Built like an internal tool, made to feel like a modern OpusGrid application.

---

## Features

- **First-run setup wizard** — point the app at your Homepage config directory
  once. Nothing is hard-coded.
- **Automatic detection** of `.yaml`, `.yml`, `.css`, `.js` files (searched up
  to a few folders deep) and a **clean sidebar** that groups them into
  *Services, Bookmarks, Settings, Widgets, Docker, Kubernetes, Custom CSS,
  Custom JS, Other*.
- **Proper code editor** (Monaco — the editor behind VS Code) with syntax
  highlighting for YAML/CSS/JS.
- **Edit & save** directly to disk.
- **YAML validation before saving** — with inline gutter markers and a friendly
  error strip; invalid YAML is refused.
- **Unsaved-change indicator** (dot + "Unsaved changes" + count in the top bar).
- **Real-time external-change detection** over a WebSocket (filesystem watcher).
- **Conflict warning instead of silent overwrites** — optimistic hashing + a
  two-pane conflict dialog (keep yours / take on-disk).
- **Basic file version history with restore** — an automatic snapshot is stored
  before every save.
- **Secure filesystem sandboxing** — no `../`, no symlink escapes, no absolute
  paths, only editable extensions, and the browser never receives the raw root
  path as an unrestricted handle.
- **Clear permission & error messages** (readable diagnostics for missing or
  non-writable directories).

---

## Quick start (Docker Compose)

1. Create a `docker-compose.yml` (a ready one ships in this repo) and edit the
   **host path** on the left side of the mount to your real Homepage config dir:

   ```yaml
   services:
     homepage-manager:
       build: .
       image: homepage-manager:local
       container_name: homepage-manager
       restart: unless-stopped
       ports:
         - "3001:3001"
       environment:
         PORT: "3001"
         HOST: "0.0.0.0"
         # UID/GID the app runs as — set to match the owner of the Homepage
         # config dir on your host (`id -u` / `id -g`).
         PUID: "1000"
         PGID: "1000"
       volumes:
         # ── CHANGE THIS host path ─────────────────────────────
         - /host/path/to/your/homepage:/homepage-config
         # persistent app data (settings + version history)
         - homepage-manager-data:/app/data
       tmpfs:
         - /tmp

   volumes:
     homepage-manager-data:
   ```

2. Start it:

   ```bash
   docker compose up -d --build
   ```

3. Open **http://localhost:3001**. On first launch you'll be asked for the
   Homepage configuration directory. Because the folder is mounted at
   `/homepage-config` **inside the container**, enter:

   ```
   /homepage-config
   ```

   The app stores its own settings + history in the `homepage-manager-data`
   volume — **never** inside your Homepage config directory.

> The app **does not run as root**. The container entrypoint drops privileges to
> `$PUID`/`$PGID` (default `1000`). Make sure the directory you mount is readable
> and writable by those IDs — the setup screen will tell you if it isn't.

### Prebuilt image (GitHub Container Registry)

A `linux/amd64` image is built automatically from `main` and published to GHCR
(a native build so it is fast and reliable):

```
ghcr.io/lucif3r-d3vil/homepage-manager:latest
```

Version tags (`v1.2.3` → `ghcr.io/lucif3r-d3vil/homepage-manager:1.2.3`) are
published for tagged releases, and short-sha tags (`sha-<7 chars>`) for every
push. In `docker-compose.yml` you can swap `build: .` for the published image:

```yaml
image: ghcr.io/lucif3r-d3vil/homepage-manager:latest
```

so you don't have to build locally. Keep the two `volumes` mounts the same.

---

## Running locally (development)

Requires **Node 20+**.

```bash
npm install
npm run dev          # backend (tsx watch) + web (vite) concurrently
```

- Web UI (dev): http://localhost:5173  (proxies `/api` + `/ws` to the backend)
- Backend API: http://localhost:3001

### Production build & run

```bash
npm run build        # type-checks + lints + builds server & web
npm start            # serves the API and the built web UI from one port (3001)
```

Environment (all optional):

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port |
| `HOST` | `0.0.0.0` | Bind interface |
| `HOMEPAGE_MANAGER_DATA_DIR` | `./data` | Where app settings + history are stored |

---

## The workflow you asked about, end to end

**Setup → detect files → edit → validate → save → see it on disk → detect external
changes → restore a previous version.**

1. On first launch the **setup wizard** asks for the config directory, verifies
   it exists and is readable/writable, and saves the choice in the app's data
   dir (persists across restarts).
2. The sidebar lists every discovered config file, grouped and typed.
3. Pick a file; the Monaco editor opens it with the right language.
4. Edit — a dirty indicator appears; if it's YAML we auto-check as you type.
5. Hit **Validate** to run a real YAML parse and see errors inline.
6. Hit **Save** (or `Cmd/Ctrl+S`). The file is written to disk immediately.
7. Open the file on your server/editor — the change is there. If another tool
   modifies the file, the app detects it **in realtime** and either refreshes
   (no local edits) or flags a **conflict**.
8. If you ever overwrite something you didn't mean to, open **History**, pick a
   previous snapshot, preview it, and **Restore**.

---

## Architecture

A clean two-part monorepo (npm workspaces) with a shared, **type-only** contract:

```
homepage-manager/
├─ shared/            type-only shared models (@homepage-manager/shared)
├─ server/            Node + Express + ws backend
│  └─ src/
│     ├─ index.ts         bootstrap (env, HTTP+WS server)
│     ├─ app.ts           Express routes + static hosting + websocket upgrade
│     ├─ manager.ts       core orchestration (read/save/list/history)
│     ├─ sandbox.ts       secure path resolution (traversal & symlink guards)
│     ├─ classify.ts      filename → kind/language/sidebar-group
│     ├─ validate.ts      js-yaml validation
│     ├─ history.ts       per-file snapshot store (JSON, capped)
│     ├─ settings.ts      app data dir + settings persistence
│     └─ watcher.ts       chokidar watcher feeding the websocket
├─ web/               React + TypeScript + Vite + Monaco front-end
│  └─ src/
│     ├─ store.tsx        central state + websocket live-updates
│     ├─ App.tsx          screen routing
│     ├─ components/      sidebar, editor, modals, status pills, toasts
│     └─ screens/         first-run setup wizard
├─ server/tests/      sandbox, validate, manager, and HTTP API tests
└─ Dockerfile / docker-compose.yml / .env.example
```

- **Front-end:** React 18, TypeScript, Vite, `@monaco-editor/react`, custom YAML
  language/tokenizer + theme.
- **Back-end:** Node/TypeScript (CommonJS build), Express, `ws`, `chokidar`,
  `js-yaml`.

---

## Security model

Homepage Manager writes straight to your server's files, so the backend treats
every user-supplied path as hostile:

- Relative paths only; `..`, absolute paths and drive letters are rejected.
- The configured root and every opened file/directory are `realpath`-resolved and
  verified to live **inside** the configured directory — this defeats symlink
  escapes.
- Only `.yaml`, `.yml`, `.css`, `.js` can be read or written.
- YAML is parsed (and refused) before any write.
- Writes go through optimistic conflict detection (`expectedHash`); the client is
  told about a mismatch instead of being silently overwritten.
- The web client only ever receives **relative** paths and file contents, never
  the raw filesystem root as an unrestricted handle, and never runs arbitrary
  commands.

---

## Tests & quality

```bash
npm run typecheck   # strict TS for server + web
npm run lint        # eslint
npm test            # vitest — sandbox, YAML validation, manager + full HTTP API
npm run build       # production build of server + web
```

---

## Notes / limitations

- The version history keeps the last 50 snapshots per file, stored as JSON in
  the app data dir. It's a lightweight undo helper, **not** a replacement for
  real backups or git.
- The app has no user login — it's intended for a trusted LAN/VPN. Put it behind
  your reverse proxy with auth if it will be reachable beyond your network.
