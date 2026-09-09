import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  FileContent,
  HomepageFileMeta,
  SaveFileResponse,
  SetupState,
  StatusResponse,
  ValidateIssue,
  WatchEvent,
} from "@shared";
import { api, ApiError } from "./api";

export interface Doc {
  meta: HomepageFileMeta;
  content: string;
  savedContent: string;
  dirty: boolean;
  /** True when an external change arrived while we had unsaved edits. */
  conflict: boolean;
}

export interface ConflictData {
  path: string;
  currentContent: string;
  savedHash: string;
  /** Our attempted content. */
  attempted: string;
}

export interface Toast {
  id: number;
  kind: "success" | "error" | "info" | "warn";
  message: string;
}

export type Validation = { valid: boolean; issues: ValidateIssue[] } | null;

interface AppState {
  loading: boolean;
  configured: boolean;
  configDir?: string;
  directoryUnavailable?: { exists: boolean; writable: boolean; message?: string };
  showSetup: boolean;
  files: HomepageFileMeta[];
  activePath: string | null;
  docs: Record<string, Doc>;
  busy: Record<string, boolean>;
  connected: boolean;
  activeValidation: Validation;
  validationTick: number;
  historyOpen: boolean;
  toasts: Toast[];
  conflict: ConflictData | null;
  requestSetup: (dir: string) => Promise<void>;
  openSetup: () => void;
  closeSetup: () => void;
  openFile: (path: string) => void;
  updateContent: (path: string, value: string) => void;
  saveActive: () => Promise<void>;
  saveActiveForce: () => Promise<void>;
  discardActive: () => void;
  reloadActive: () => Promise<void>;
  restoreActive: (id: string) => Promise<void>;
  setValidation: (v: Validation) => void;
  clearValidation: () => void;
  resolveConflict: (keepMine: boolean) => Promise<void>;
  dismissConflict: () => void;
  setHistoryOpen: (v: boolean) => void;
  refreshFiles: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  toast: (kind: Toast["kind"], message: string) => void;
  dismissToast: (id: number) => void;
  dirtyCount: number;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}

let toastSeq = 1;

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<SetupState>({ configured: false });
  const [dirUnavailable, setDirUnavailable] = useState<
    AppState["directoryUnavailable"]
  >(undefined);
  const [showSetup, setShowSetup] = useState(false);
  const [files, setFiles] = useState<HomepageFileMeta[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, Doc>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);
  const [activeValidation, setActiveValidation] = useState<Validation>(null);
  const [validationTick, setValidationTick] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conflict, setConflict] = useState<ConflictData | null>(null);

  const lastSave = useRef<Record<string, number>>({});
  const stateRef = useRef({ docs, activePath, setup });
  stateRef.current = { docs, activePath, setup };

  const toast = useCallback((kind: Toast["kind"], message: string) => {
    const id = toastSeq++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const list = await api.files();
      setFiles(list);
      const idx = new Map(list.map((f) => [f.path, f]));
      setDocs((prev) => {
        let changed = false;
        const next: Record<string, Doc> = { ...prev };
        for (const key of Object.keys(next)) {
          const fresh = idx.get(key);
          if (fresh && fresh.hash !== next[key].meta.hash) {
            next[key] = { ...next[key], meta: fresh };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "NOT_CONFIGURED") {
          setSetup({ configured: false });
          setShowSetup(true);
        }
        // UNAVAILABLE etc. handled by status poll; ignore transient here.
      }
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const st: StatusResponse = await api.status();
      setSetup(st.setup);
      if (!st.setup.configured) {
        setDirUnavailable(undefined);
        setShowSetup(true);
        setFiles([]);
        return;
      }
      setDirUnavailable({
        exists: st.exists ?? true,
        writable: st.writable ?? true,
        message: st.message,
      });
    } catch (err) {
      if (err instanceof ApiError) toast("error", err.message);
    }
  }, [toast]);

  // ---- WebSocket live watching ----
  useEffect(() => {
    if (!setup.configured) return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closedByUs = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closedByUs) retry = setTimeout(connect, 2500);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WatchEvent;
          if (msg.type === "reconfigured") {
            refreshStatus();
            refreshFiles();
            return;
          }
          handleWatch(msg);
        } catch {
          /* ignore malformed frames */
        }
      };
    };

    const handleWatch = (msg: Extract<WatchEvent, { type: "change" }>) => {
      const rel = msg.path;
      const { docs: d, activePath: ap } = stateRef.current;
      // Ignore rapid events caused by our own recent saves.
      const last = lastSave.current[rel];
      if (last && Date.now() - last < 1600) return;
      refreshFiles();
      const doc = d[rel];
      if (!doc) return; // not an open file -> listing already refreshed
      if (msg.event === "unlink") {
        setDocs((prev) => {
          const n = { ...prev };
          delete n[rel];
          return n;
        });
        if (ap === rel) {
          setActivePath(null);
          toast("error", `"${rel}" was removed from the config directory.`);
        }
        return;
      }
      if (doc.dirty) {
        setDocs((prev) =>
          prev[rel]
            ? { ...prev, [rel]: { ...prev[rel], conflict: true } }
            : prev
        );
        toast("warn", `"${rel}" changed on disk while you had unsaved edits.`);
        return;
      }
      // Clean buffer -> pull the fresh content in.
      api
        .read(rel)
        .then((fc: FileContent) => {
          setDocs((prev) => ({
            ...prev,
            [rel]: {
              meta: fc,
              content: fc.content,
              savedContent: fc.content,
              dirty: false,
              conflict: false,
            },
          }));
          if (rel === ap) setActiveValidation(null);
        })
        .catch(() => {
          /* file may be gone */
        });
    };

    connect();
    return () => {
      closedByUs = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [setup.configured]);

  // ---- Boot ----
  useEffect(() => {
    (async () => {
      try {
        const st: StatusResponse = await api.status();
        setSetup(st.setup);
        if (!st.setup.configured) {
          setShowSetup(true);
          return;
        }
        setDirUnavailable({
          exists: st.exists ?? true,
          writable: st.writable ?? true,
          message: st.message,
        });
        try {
          const list = await api.files();
          setFiles(list);
        } catch {
          /* ignore */
        }
      } catch {
        toast("error", "Unable to reach the Homepage Manager server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- Per-file helpers ----

  const setBusyFor = useCallback((path: string, on: boolean) => {
    setBusy((b) => ({ ...b, [path]: on }));
  }, []);

  const openFile = useCallback((path: string) => {
    setActivePath(path);
    setHistoryOpen(false);
    setActiveValidation(null);
    setDocs((prev) => {
      if (prev[path]) return prev; // already buffered
      // optimistic placeholder until content loads
      return prev;
    });
    setBusyFor(path, true);
    api
      .read(path)
      .then((fc) => {
        setDocs((prev) => {
          if (prev[path]) {
            // a ws update may have arrived first; only seed if absent
            return prev;
          }
          return {
            ...prev,
            [path]: {
              meta: fc,
              content: fc.content,
              savedContent: fc.content,
              dirty: false,
              conflict: false,
            },
          };
        });
      })
      .catch((err) => {
        if (err instanceof ApiError) toast("error", err.message);
      })
      .finally(() => setBusyFor(path, false));
  }, [toast]);

  const updateContent = useCallback((path: string, value: string) => {
    setDocs((prev) => {
      const doc = prev[path];
      if (!doc || doc.content === value) return prev;
      return {
        ...prev,
        [path]: {
          ...doc,
          content: value,
          dirty: value !== doc.savedContent,
          conflict: value !== doc.savedContent ? doc.conflict : false,
        },
      };
    });
    setActiveValidation(null);
  }, []);

  const setValidation = useCallback((v: Validation) => {
    setActiveValidation(v);
    setValidationTick((t) => t + 1);
  }, []);
  const clearValidation = useCallback(() => setActiveValidation(null), []);

  const applySaved = useCallback(
    (path: string, res: SaveFileResponse) => {
      lastSave.current[path] = Date.now();
      setDocs((prev) => {
        const doc = prev[path];
        if (!doc) return prev;
        return {
          ...prev,
          [path]: {
            ...doc,
            meta: { ...doc.meta, hash: res.hash, mtime: res.mtime },
            content: doc.content,
            savedContent: doc.content,
            dirty: false,
            conflict: false,
          },
        };
      });
      setFiles((list) =>
        list.map((f) =>
          f.path === path ? { ...f, hash: res.hash, mtime: res.mtime } : f
        )
      );
    },
    []
  );

  const failSave = useCallback(
    (path: string, err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.payload as SaveFileResponse | undefined;
        if (body && body.conflict) {
          const attempted = stateRef.current.docs[path]?.content ?? "";
          setConflict({
            path,
            currentContent: body.currentContent ?? "",
            savedHash: body.currentHash ?? body.hash,
            attempted,
          });
          return;
        }
      }
      if (err instanceof ApiError) toast("error", err.message);
      else toast("error", "Failed to save file.");
    },
    [toast]
  );

  const saveActive = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return;
    const doc = stateRef.current.docs[path];
    if (!doc) return;
    if (!doc.dirty) {
      toast("info", `"${path}" is already up to date.`);
      return;
    }
    setBusyFor(path, true);
    try {
      const res = await api.save(path, doc.content, doc.meta.hash, false);
      applySaved(path, res);
      toast("success", `Saved "${path}".`);
    } catch (err) {
      failSave(path, err);
    } finally {
      setBusyFor(path, false);
    }
  }, [toast]);

  const saveActiveForce = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return;
    const doc = stateRef.current.docs[path];
    if (!doc) return;
    setBusyFor(path, true);
    try {
      const res = await api.save(path, doc.content, undefined, true);
      applySaved(path, res);
      toast("success", `Saved "${path}".`);
    } catch (err) {
      failSave(path, err);
    } finally {
      setBusyFor(path, false);
    }
  }, [toast]);

  const discardActive = useCallback(() => {
    const path = stateRef.current.activePath;
    if (!path) return;
    setDocs((prev) => {
      const doc = prev[path];
      if (!doc) return prev;
      return {
        ...prev,
        [path]: {
          ...doc,
          content: doc.savedContent,
          dirty: false,
          conflict: false,
        },
      };
    });
    setActiveValidation(null);
    toast("info", `Discarded unsaved changes to "${path}".`);
  }, [toast]);

  const reloadActive = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return;
    setBusyFor(path, true);
    try {
      const fc = await api.read(path);
      setDocs((prev) => ({
        ...prev,
        [path]: {
          meta: fc,
          content: fc.content,
          savedContent: fc.content,
          dirty: false,
          conflict: false,
        },
      }));
      setActiveValidation(null);
      toast("info", `Reloaded "${path}" from disk.`);
    } catch (err) {
      if (err instanceof ApiError) toast("error", err.message);
    } finally {
      setBusyFor(path, false);
    }
  }, [toast]);

  const restoreActive = useCallback(
    async (id: string) => {
      const path = stateRef.current.activePath;
      if (!path) return;
      const doc = stateRef.current.docs[path];
      if (!doc) return;
      setBusyFor(path, true);
      try {
        const res = await api.restore(path, id, doc.meta.hash);
        lastSave.current[path] = Date.now();
        setDocs((prev) => {
          const d = prev[path];
          if (!d) return prev;
          return {
            ...prev,
            [path]: {
              ...d,
              meta: { ...d.meta, hash: res.hash, mtime: res.mtime },
              content: res.content,
              savedContent: res.content,
              dirty: false,
              conflict: false,
            },
          };
        });
        setFiles((list) =>
          list.map((f) =>
            f.path === path ? { ...f, hash: res.hash, mtime: res.mtime } : f
          )
        );
        setActiveValidation(null);
        setHistoryOpen(false);
        toast("success", `Restored a previous version of "${path}".`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          toast(
            "error",
            `"${path}" changed on disk since you opened it. Reload the file and try again.`
          );
        } else if (err instanceof ApiError) {
          toast("error", err.message);
        } else {
          toast("error", "Restore failed.");
        }
      } finally {
        setBusyFor(path, false);
      }
    },
    [toast, setBusyFor]
  );

  const resolveConflict = useCallback(
    async (keepMine: boolean) => {
      const c = conflict;
      if (!c) return;
      setConflict(null);
      const path = stateRef.current.activePath;
      if (!path) return;
      if (keepMine) {
        setBusyFor(path, true);
        try {
          const res = await api.save(path, c.attempted, undefined, true);
          applySaved(path, res);
          toast("success", `Saved "${path}" over the on-disk version.`);
        } catch (err) {
          failSave(path, err);
        } finally {
          setBusyFor(path, false);
        }
      } else {
        const fc = await api.read(path).catch(() => null);
        if (fc) {
          setDocs((prev) => ({
            ...prev,
            [path]: {
              meta: fc,
              content: fc.content,
              savedContent: fc.content,
              dirty: false,
              conflict: false,
            },
          }));
          setActiveValidation(null);
          toast("info", `Loaded the on-disk version of "${path}".`);
        }
      }
    },
    [conflict, toast, applySaved, failSave]
  );

  const dismissConflict = useCallback(() => setConflict(null), []);

  const requestSetup = useCallback(
    async (dir: string) => {
      try {
        const st = await api.setup(dir);
        setSetup(st);
        setShowSetup(false);
        setDirUnavailable(undefined);
        await refreshStatus();
        await refreshFiles();
        toast("success", `Connected to ${st.configDir}.`);
      } catch (err) {
        throw err;
      }
    },
    [refreshStatus, refreshFiles, toast]
  );

  const openSetup = useCallback(() => setShowSetup(true), []);
  const closeSetup = useCallback(() => setShowSetup(false), []);

  const dirtyCount = useMemo(
    () => Object.values(docs).filter((d) => d.dirty).length,
    [docs]
  );

  const value: AppState = {
    loading,
    configured: setup.configured,
    configDir: setup.configDir,
    directoryUnavailable: dirUnavailable,
    showSetup,
    files,
    activePath,
    docs,
    busy,
    connected,
    activeValidation,
    validationTick,
    historyOpen,
    toasts,
    conflict,
    requestSetup,
    openSetup,
    closeSetup,
    openFile,
    updateContent,
    saveActive,
    saveActiveForce,
    discardActive,
    reloadActive,
    restoreActive,
    setValidation,
    clearValidation,
    resolveConflict,
    dismissConflict,
    setHistoryOpen,
    refreshFiles,
    refreshStatus,
    toast,
    dismissToast,
    dirtyCount,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
