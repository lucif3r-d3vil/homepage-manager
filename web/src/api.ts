import type {
  FileContent,
  HistoryItemResponse,
  HistoryResponse,
  HomepageFileMeta,
  RestoreResponse,
  SaveFileResponse,
  SetupState,
  StatusResponse,
  ValidateResponse,
} from "@shared";

export class ApiError extends Error {
  code: string;
  status: number;
  payload: unknown;
  constructor(message: string, code: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = body as { error?: string; code?: string };
    throw new ApiError(
      err?.error ?? `Request failed (${res.status})`,
      err?.code ?? "ERROR",
      res.status,
      body
    );
  }
  return body as T;
}

export const api = {
  status: () => request<StatusResponse>("/api/status"),
  setup: (configDir: string) =>
    request<SetupState>("/api/setup", {
      method: "POST",
      body: JSON.stringify({ configDir }),
    }),
  forget: () =>
    request<{ ok: boolean }>("/api/setup", { method: "DELETE" }),
  files: () => request<HomepageFileMeta[]>("/api/files"),
  read: (path: string) => request<FileContent>(`/api/files/${encodeRel(path)}`),
  save: (
    path: string,
    content: string,
    expectedHash?: string,
    force = false
  ) =>
    request<SaveFileResponse>(`/api/files/${encodeRel(path)}/save`, {
      method: "POST",
      body: JSON.stringify({ content, expectedHash, force }),
    }),
  validate: (content: string, language: string) =>
    request<ValidateResponse>("/api/validate", {
      method: "POST",
      body: JSON.stringify({ content, language }),
    }),
  history: (path: string) =>
    request<HistoryResponse>(`/api/files/${encodeRel(path)}/history`),
  historyItem: (path: string, id: string) =>
    request<HistoryItemResponse>(
      `/api/files/${encodeRel(path)}/history/${encodeURIComponent(id)}`
    ),
  restore: (path: string, id: string, expectedHash?: string) =>
    request<RestoreResponse>(
      `/api/files/${encodeRel(path)}/restore/${encodeURIComponent(id)}`,
      {
        method: "POST",
        body: JSON.stringify({ expectedHash }),
      }
    ),
};

/** Encode a relative path into a single URL path segment (safe chars). */
function encodeRel(path: string): string {
  return path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}
