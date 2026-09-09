import { useMemo, useState } from "react";
import type { FileGroup, HomepageFileMeta } from "@shared";
import { useApp } from "../store";
import { Icon, type IconName } from "./Icon";
import { classNames } from "../lib/format";

const GROUP_ORDER: FileGroup[] = [
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

function groupIcon(g: FileGroup): IconName {
  switch (g) {
    case "Custom CSS":
      return "css";
    case "Custom JS":
      return "js";
    default:
      return "yaml";
  }
}

export function Sidebar() {
  const {
    files,
    docs,
    activePath,
    openFile,
    configDir,
    openSetup,
    refreshFiles,
  } = useApp();
  const [q, setQ] = useState("");

  const byGroup = useMemo(() => {
    const map = new Map<FileGroup, HomepageFileMeta[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const f of files) {
      const arr = map.get(f.group);
      if (arr) arr.push(f);
    }
    return map;
  }, [files]);

  const filter = (f: HomepageFileMeta) => {
    if (!q.trim()) return true;
    return f.name.toLowerCase().includes(q.trim().toLowerCase());
  };

  const groups = GROUP_ORDER.filter((g) => (byGroup.get(g) ?? []).length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <span className="sidebar__title">Configuration files</span>
        <span className="sidebar__count">{files.length}</span>
      </div>
      <div className="sidebar__search">
        <Icon name="file" size={14} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter files…"
          spellCheck={false}
        />
        {q && (
          <button className="sidebar__clear" onClick={() => setQ("")}>
            <Icon name="x" size={12} />
          </button>
        )}
      </div>

      <nav className="sidebar__nav">
        {groups.length === 0 && (
          <div className="sidebar__empty">
            No editable files found yet. Connect to a Homepage config directory to
            get started.
          </div>
        )}
        {groups.map((g) => {
          const items = (byGroup.get(g) ?? []).filter(filter);
          if (items.length === 0) return null;
          return (
            <div key={g} className="group">
              <div className="group__label">
                <span className="group__icon">
                  <Icon name={groupIcon(g)} size={13} />
                </span>
                <span>{g}</span>
                <span className="group__n">{items.length}</span>
              </div>
              <div className="group__items">
                {items.map((f) => {
                  const doc = docs[f.path];
                  const active = activePath === f.path;
                  return (
                    <button
                      key={f.path}
                      className={classNames("file-item", active && "is-active")}
                      onClick={() => openFile(f.path)}
                      title={`${f.path}${doc?.conflict ? " — changed on disk" : ""}`}
                    >
                      <span className={classNames("file-item__icon", `k-${f.kind}`)}>
                        <Icon
                          name={
                            f.kind === "css" ? "css" : f.kind === "js" ? "js" : "yaml"
                          }
                          size={15}
                        />
                      </span>
                      <span className="file-item__name">{f.name}</span>
                      {doc?.conflict && (
                        <span className="file-item__badge is-warn" title="Changed on disk">
                          <Icon name="warning" size={11} />
                        </span>
                      )}
                      {doc?.dirty && !doc.conflict && (
                        <span className="file-item__badge is-dirty" title="Unsaved changes" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar__foot">
        <button className="sidebar__refresh" onClick={() => refreshFiles()} title="Re-scan files">
          <Icon name="refresh" size={14} />
          Refresh
        </button>
        <button className="sidebar__dir" onClick={openSetup} title="Change configuration directory">
          <Icon name="settings" size={14} />
          <span className="sidebar__dir-path" title={configDir}>
            {configDir}
          </span>
        </button>
      </div>
    </aside>
  );
}
