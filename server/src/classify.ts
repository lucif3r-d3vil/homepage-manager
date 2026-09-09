import type { EditorLanguage, FileGroup, HomepageFileKind } from "@homepage-manager/shared";

const KNOWN: Record<string, { group: FileGroup }> = {
  "services.yaml": { group: "Services" }, "bookmarks.yaml": { group: "Bookmarks" },
  "settings.yaml": { group: "Settings" }, "widgets.yaml": { group: "Widgets" },
  "docker.yaml": { group: "Docker" }, "kubernetes.yaml": { group: "Kubernetes" },
  "custom.css": { group: "Custom CSS" }, "custom.js": { group: "Custom JS" },
};
export interface FileSpec { kind: HomepageFileKind; language: EditorLanguage; group: FileGroup; }
export function extensionOf(name: string): string { const i = name.lastIndexOf("."); return i < 0 ? "" : name.slice(i + 1).toLowerCase(); }

// Homepage also uses .env and JSON in addition to its core YAML/CSS/JS files.
// Keep this deliberately extension based so new, safe text configuration files are visible.
const SAFE_TEXT = new Set(["yaml", "yml", "json", "css", "js", "mjs", "cjs", "env", "txt", "conf", "toml"]);
export function isEditableName(name: string): boolean {
  const ext = extensionOf(name);
  return name === ".env" || SAFE_TEXT.has(ext);
}
export function languageFor(ext: string): EditorLanguage {
  const e = ext.toLowerCase();
  if (e === "css") return "css";
  if (["js", "mjs", "cjs"].includes(e)) return "javascript";
  if (e === "json") return "json";
  if (e === "env") return "dotenv";
  if (["txt", "conf", "toml", ""].includes(e)) return "plaintext";
  return "yaml";
}
export function classify(rel: string): FileSpec {
  const name = rel.split("/").pop() ?? rel;
  const ext = extensionOf(name);
  const kind = (ext || (name === ".env" ? "env" : "txt")) as HomepageFileKind;
  return { kind, language: languageFor(ext), group: KNOWN[rel]?.group ?? "Other" };
}
export const ALL_GROUPS: FileGroup[] = ["Services", "Bookmarks", "Settings", "Widgets", "Docker", "Kubernetes", "Custom CSS", "Custom JS", "Other"];
