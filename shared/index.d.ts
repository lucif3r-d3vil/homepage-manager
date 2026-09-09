/**
 * Type-only contract shared between the Homepage Manager server and web client.
 *
 * This file intentionally declares *only* types (no runtime values), so it can be
 * consumed by both the Node backend and the browser bundle without a build step.
 */

export type HomepageFileKind = "yaml" | "yml" | "json" | "css" | "js" | "mjs" | "cjs" | "env" | "txt" | "conf" | "toml";
export type EditorLanguage = "yaml" | "css" | "javascript" | "json" | "dotenv" | "plaintext";

/** A convenience group shown in the sidebar. */
export type FileGroup =
  | "Services"
  | "Bookmarks"
  | "Settings"
  | "Widgets"
  | "Docker"
  | "Kubernetes"
  | "Custom CSS"
  | "Custom JS"
  | "Other";

export interface HomepageFileMeta {
  /** Relative, posix-normalised path inside the configured root, e.g. "services.yaml". */
  path: string;
  /** Just the file name. */
  name: string;
  /** Relative directory ("" when the file sits at the root). */
  dir: string;
  /** Canonical file kind derived from the extension. */
  kind: HomepageFileKind;
  /** Language handed to the editor. */
  language: EditorLanguage;
  /** Sidebar group. */
  group: FileGroup;
  /** Byte size. */
  size: number;
  /** mtime as ISO string. */
  mtime: string;
  /** Content hash (sha1) at last read — used for conflict detection. */
  hash: string;
  readAllowed?: boolean;
  writeAllowed?: boolean;
  readError?: string;
  writeError?: string;
}

export interface FileContent extends HomepageFileMeta {
  content: string;
}

export interface SetupState {
  /** True once a configuration directory has been set and verified. */
  configured: boolean;
  /** The absolute path of the Homepage config directory (only when configured). */
  configDir?: string;
}

export interface StatusResponse {
  setup: SetupState;
  /** Whether the configured directory currently exists on disk. */
  exists?: boolean;
  /** Whether the configured directory is writable right now. */
  writable?: boolean;
  /** Human readable diagnostics when the directory is unavailable. */
  message?: string;
  files?: HomepageFileMeta[];
  /** Number of discovered files. */
  fileCount?: number;
}

export interface SetupRequest {
  configDir: string;
}

export type ValidateIssueType = "error" | "warning";

export interface ValidateIssue {
  type: ValidateIssueType;
  message: string;
  /** 1-based line (when available). */
  line?: number;
  /** 1-based column (when available). */
  column?: number;
}

export interface ValidateRequest {
  /** File content to validate. */
  content: string;
  /** The language/kind to validate against ("yaml" | "yml" | "css" | "js"). */
  language: EditorLanguage;
}

export interface ValidateResponse {
  valid: boolean;
  issues: ValidateIssue[];
}

export interface SaveFileRequest {
  content: string;
  /**
   * Hash of the content the client last saw. When it does not match the current
   * on-disk hash the server refuses to overwrite (returns a conflict) unless
   * `force` is set.
   */
  expectedHash?: string;
  /** Bypass optimistic conflict detection (used by an explicit "Overwrite"). */
  force?: boolean;
}

export interface SaveFileResponse {
  ok: boolean;
  conflict?: boolean;
  path: string;
  hash: string;
  mtime: string;
  /** When a conflict occurred, the current on-disk content the user may want to see. */
  currentContent?: string;
  currentHash?: string;
}

export interface HistoryEntry {
  /** Stable id for this snapshot. */
  id: string;
  /** Creation time (ISO). */
  createdAt: string;
  /** Content hash of the snapshot. */
  hash: string;
  /** Byte size. */
  size: number;
}

export interface HistoryResponse {
  path: string;
  entries: HistoryEntry[];
}

export interface HistoryItemResponse {
  id: string;
  path: string;
  content: string;
  createdAt: string;
  hash: string;
}

export interface RestoreRequest {
  /** Optional optimistic hash of the *current* file content. */
  expectedHash?: string;
}

export interface RestoreResponse {
  ok: boolean;
  conflict?: boolean;
  path: string;
  content: string;
  hash: string;
  mtime: string;
  currentContent?: string;
  currentHash?: string;
}

export interface ErrorResponse {
  error: string;
  /** Stable machine code, e.g. "PATH_TRAVERSAL". */
  code: string;
  details?: unknown;
}

/** Message pushed from the server over the websocket. */
export type WatchEvent =
  | {
      type: "change";
      /** Relative path of the file that changed (unlink events reuse the old path). */
      path: string;
      event: "add" | "change" | "unlink" | "addDir" | "unlinkDir";
    }
  | {
      type: "reconfigured";
      path?: string;
    };


