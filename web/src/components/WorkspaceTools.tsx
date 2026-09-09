import { useEffect, useMemo, useState, type ReactNode } from "react";
import yaml from "js-yaml";
import { api } from "../api";
import { Icon } from "./Icon";
import { useApp } from "../store";

type Tool = "editor" | "preview" | "templates" | "icons";
const templates = [
  { name: "Service", type: "Service", value: `- My Service:\n    href: http://localhost:8080\n    description: A useful Homepage service\n    icon: mdi-server\n` },
  { name: "Service with widget", type: "Service", value: `- My Service:\n    href: http://localhost:8080\n    icon: mdi-server\n    widget:\n      type: radarr\n      url: http://radarr:7878\n      key: YOUR_API_KEY\n` },
  { name: "Bookmark", type: "Bookmark", value: `- Tools:\n    - Homepage:\n        - abbr: HP\n          href: https://gethomepage.dev\n          icon: homepage\n` },
  { name: "Bookmark group", type: "Bookmark", value: `- Resources:\n    - Documentation:\n        - abbr: DOC\n          href: https://example.com\n          icon: mdi-book-open\n` },
  { name: "Widget", type: "Widget", value: `- resources:\n    cpu: true\n    memory: true\n    disk: /\n` },
  { name: "Media services", type: "Services", value: `- Media:\n    - Jellyfin:\n        href: http://jellyfin:8096\n        icon: jellyfin\n        description: Movies and shows\n    - Seerr:\n        href: http://seerr:5055\n        icon: seerr\n` },
  { name: "Self-hosted services", type: "Services", value: `- Infrastructure:\n    - Proxmox:\n        href: https://proxmox.local:8006\n        icon: proxmox\n    - AdGuard Home:\n        href: http://adguard.local\n        icon: adguard-home\n` },
];
const icons = ["homepage", "jellyfin", "seerr", "immich", "navidrome", "sonarr", "radarr", "proxmox", "docker", "github", "globe", "mdi-server", "mdi-book-open", "adguard-home", "grafana", "home-assistant", "plex", "qbittorrent", "nextcloud", "paperless-ngx"];

function yamlData(text: string): any { try { return yaml.load(text) as any; } catch { return null; } }

export function WorkspaceTools({ children }: { children: ReactNode }) {
  const { files, docs, activePath, updateContent, toast } = useApp();
  const [tool, setTool] = useState<Tool>("editor");
  const [query, setQuery] = useState("");
  const [templateDraft, setTemplateDraft] = useState<Record<string, string>>(() => Object.fromEntries(templates.map(t => [t.name, t.value])));
  const [previewText, setPreviewText] = useState<Record<string, string>>({});
  const [dragged, setDragged] = useState<{ group: string; index: number } | null>(null);

  useEffect(() => {
    if (tool !== "preview") return;
    const paths = files.filter(f => f.name === "services.yaml" || f.name === "bookmarks.yaml").map(f => f.path);
    Promise.all(paths.map(async p => [p, docs[p]?.content ?? (await api.read(p)).content] as const))
      .then(entries => setPreviewText(Object.fromEntries(entries))).catch(() => toast("warn", "Preview could not load the dashboard YAML."));
  }, [tool, files, docs, toast]);

  const addTemplate = (value: string) => {
    const target = activePath && docs[activePath] ? activePath : files.find(f => f.name === "services.yaml")?.path;
    if (!target || !docs[target]) { toast("info", "Open a YAML configuration file first, then add a template."); return; }
    const current = docs[target].content.trimEnd();
    updateContent(target, `${current}\n\n# Added from OpusGrid template\n${value.trim()}\n`);
    setTool("editor");
    toast("success", "Template added without overwriting existing YAML.");
  };

  const insertIcon = (icon: string) => {
    const target = activePath && docs[activePath] ? activePath : null;
    if (target) updateContent(target, `${docs[target].content.trimEnd()}\nicon: ${icon}\n`);
    navigator.clipboard?.writeText(icon).catch(() => undefined);
    toast("success", `${icon} copied — Homepage YAML value preserved.`);
  };

  const reorder = async (groupName: string, fromGroup: string, from: number, to: number) => {
    const path = files.find(f => f.name === "services.yaml")?.path;
    if (!path) return;
    const text = previewText[path]; const data = yamlData(text);
    if (!Array.isArray(data)) return;
    const source = data.find((x: any) => x && typeof x === "object" && x[fromGroup]);
    const target = data.find((x: any) => x && typeof x === "object" && x[groupName]);
    const sourceEntries = source?.[fromGroup]; const targetEntries = target?.[groupName];
    if (!Array.isArray(sourceEntries) || !Array.isArray(targetEntries)) return;
    const [item] = sourceEntries.splice(from, 1); targetEntries.splice(to, 0, item);
    const next = yaml.dump(data, { noRefs: true, lineWidth: -1 });
    setPreviewText(p => ({ ...p, [path]: next }));
    updateContent(path, next);
    toast("info", `Moved ${Object.keys(item ?? {})[0] ?? "service"}. Review and save services.yaml.`);
  };

  const filteredIcons = useMemo(() => icons.filter(i => i.includes(query.toLowerCase())), [query]);
  return <>
    <div className="modebar" role="tablist" aria-label="Workspace mode">
      <button className={tool === "editor" ? "is-active" : ""} onClick={() => setTool("editor")}>Editor</button>
      <button className={tool === "preview" ? "is-active" : ""} onClick={() => setTool("preview")}>Preview</button>
      <span className="modebar__rule" />
      <button className={tool === "templates" ? "is-active" : ""} onClick={() => setTool("templates")}><Icon name="plus" size={14}/> Templates</button>
      <button className={tool === "icons" ? "is-active" : ""} onClick={() => setTool("icons")}><Icon name="spark" size={14}/> Icon Browser</button>
    </div>
    {tool === "editor" ? children : tool === "templates" ? <section className="tool-surface"><div className="tool-heading"><div><p className="eyebrow">Building blocks</p><h2>Configuration templates</h2><p>Customize a safe starting point, then add it below your existing YAML.</p></div></div><div className="template-grid">{templates.map(t => <article className="template-card" key={t.name}><div className="template-card__top"><span className="template-card__type">{t.type}</span><h3>{t.name}</h3></div><textarea className="template-editor" value={templateDraft[t.name] ?? t.value} onChange={e => setTemplateDraft(d => ({ ...d, [t.name]: e.target.value }))} spellCheck={false}/><button className="btn btn--primary btn--sm" onClick={() => addTemplate(templateDraft[t.name] ?? t.value)}>Add to configuration</button></article>)}</div></section> : tool === "icons" ? <section className="tool-surface"><div className="tool-heading"><div><p className="eyebrow">Homepage icon formats</p><h2>Find an icon</h2><p>Click any icon to copy its YAML value and append it to the open file.</p></div><input className="tool-search" placeholder="Search icons…" value={query} onChange={e => setQuery(e.target.value)}/></div><div className="icon-grid">{filteredIcons.map(i => <button className="icon-tile" key={i} onClick={() => insertIcon(i)}><span className="icon-tile__glyph">{i.startsWith("mdi-") ? "✦" : "◆"}</span><span>{i}</span></button>)}</div></section> : <Preview text={previewText} dragged={dragged} setDragged={setDragged} reorder={reorder}/>} 
  </>;
}

function Preview({ text, dragged, setDragged, reorder }: { text: Record<string,string>; dragged: {group:string;index:number}|null; setDragged: (x:any)=>void; reorder: (g:string,fg:string,f:number,t:number)=>void }) {
  const path = Object.keys(text).find(p => p.includes("services")); const data = path ? yamlData(text[path]) : null;
  const groups = Array.isArray(data) ? data : [];
  return <section className="preview-surface"><div className="preview-head"><div><p className="eyebrow">Live canvas</p><h2>Homepage dashboard</h2></div><span className="preview-note"><span className="chip__dot"/> Updates from valid YAML · save to apply in Homepage</span></div><div className="homepage-preview">{groups.length ? groups.map((g:any, gi:number) => Object.entries(g ?? {}).map(([name, items]: any) => <div className="dashboard-group" key={`${gi}-${name}`}><h3>{name}</h3><div className="service-grid">{Array.isArray(items) ? items.map((item:any, i:number) => { const title = Object.keys(item ?? {})[0] ?? "Service"; return <div className="service-card" draggable onDragStart={() => setDragged({group:name,index:i})} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragged && (dragged.group !== name || dragged.index !== i)) reorder(name, dragged.group, dragged.index, i); setDragged(null); }} key={`${name}-${i}`}><span className="service-card__drag">⠿</span><div className="service-card__icon">{String(item[title]?.icon ?? "◆").slice(0,1).toUpperCase()}</div><div><strong>{title}</strong><span>{item[title]?.description ?? item[title]?.href ?? "Homepage service"}</span></div></div>; }) : <div className="empty-preview">No services in this group.</div>}</div></div>)) : <div className="empty-preview"><Icon name="document" size={30}/><strong>Open services.yaml to start previewing</strong><span>Valid changes appear here before you save them.</span></div>}</div></section>;
}
