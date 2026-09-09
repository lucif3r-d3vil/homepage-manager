import type {
  EditorLanguage,
  FileGroup,
  HomepageFileKind,
} from "@homepage-manager/shared";

const KNOWN: Record<string, { group: FileGroup; label: string }> = {
  "services.yaml": { group: "Services", label: "Services" },
  "bookmarks.yaml": { group: "Bookmarks", label: "Bookmarks" },
  "settings.yaml": { group: "Settings", label: "Settings" },
  "widgets.yaml": { group: "Widgets", label: "Widgets" },
  "docker.yaml": { group: "Docker", label: "Docker" },
  "kubernetes.yaml": { group: "Kubernetes", label: "Kubernetes" },
  "custom.css": { group: "Custom CSS", label: "Custom CSS" },
  "custom.js": { group: "Custom JS", label: "Custom JS" },
};

export interface FileSpec {
  kind: HomepageFileKind;
  language: EditorLanguage;
  group: FileGroup;
}

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx < 0 ? "" : name.slice(idx + 1).toLowerCase();
}

const KINDS = new Set<HomepageFileKind>(["yaml", "yml", "css", "js"]);

/** Only these file extensions may be read/edited through the API. */
export function isEditableName(name: string): boolean {
  return KINDS.has(extensionOf(name) as HomepageFileKind);
}

export function languageFor(ext: string): EditorLanguage {
  const e = ext.toLowerCase();
  if (e === "css") return "css";
  if (e === "js" || e === "javascript") return "javascript";
  return "yaml"; // .yaml and .yml
}

export function isYamlExt(ext: string): boolean {
  const e = ext.toLowerCase();
  return e === "yaml" || e === "yml";
}

export function classify(rel: string): FileSpec {
  const name = rel.split("/").pop() ?? rel;
  const ext = extensionOf(name);
  const kind = (ext as HomepageFileKind) || "yaml";
  const known = KNOWN[rel];
  const group: FileGroup = known ? known.group : "Other";
  return {
    kind,
    language: languageFor(ext),
    group,
  };
}

export const ALL_GROUPS: FileGroup[] = [
  "Services",
  "Bookmarks",
  "Settings",
  "Widgets",
  "Docker",
  "Kubernetes",
  "Custom CSS",
  "Custom JS",
  "Other",
];
