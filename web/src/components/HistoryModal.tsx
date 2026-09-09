import { useEffect, useState } from "react";
import type { HistoryEntry } from "@shared";
import { useApp } from "../store";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { api } from "../api";
import { formatBytes, formatTime, classNames } from "../lib/format";

export function HistoryModal() {
  const { activePath, docs, setHistoryOpen, historyOpen, restoreActive } =
    useApp();
  const path = activePath;
  const doc = path ? docs[path] : undefined;

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!historyOpen || !path) return;
    setEntries([]);
    setSelectedId(null);
    setPreview(null);
    setError(null);
    setLoading(true);
    api
      .history(path)
      .then((res) => setEntries(res.entries))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load history.")
      )
      .finally(() => setLoading(false));
  }, [historyOpen, path]);

  const pick = async (id: string) => {
    if (!path) return;
    setSelectedId(id);
    setPreview(null);
    try {
      const item = await api.historyItem(path, id);
      setPreview(item.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load version.");
    }
  };

  const onRestore = async () => {
    if (!path || !selectedId) return;
    setRestoring(true);
    await restoreActive(selectedId);
    setRestoring(false);
  };

  if (!path || !doc) return null;

  return (
    <Modal
      title="Version history"
      icon={<Icon name="history" size={17} />}
      onClose={() => setHistoryOpen(false)}
      size="lg"
      footer={
        <div className="history__foot">
          <span className="history__hint">
            Snapshots are taken automatically before every save. Restoring writes the
            selected version back to disk.
          </span>
          <div className="history__foot-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => setHistoryOpen(false)}>
              Close
            </button>
            <button
              className="btn btn--primary btn--sm"
              disabled={!selectedId || restoring}
              onClick={onRestore}
            >
              {restoring ? <span className="spinner spinner--sm" /> : <Icon name="refresh" size={15} />}
              Restore this version
            </button>
          </div>
        </div>
      }
    >
      <div className="history">
        <div className="history__list">
          <div className="history__file">{doc.meta.path}</div>
          {loading && (
            <div className="history__state">
              <span className="spinner" /> Loading versions…
            </div>
          )}
          {error && <div className="history__state is-error">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="history__state">
              <Icon name="document" size={22} />
              <p>No previous versions yet.</p>
              <span>Save changes to create automatic snapshots.</span>
            </div>
          )}
          {entries.map((e) => (
            <button
              key={e.id}
              className={classNames("history__row", selectedId === e.id && "is-active")}
              onClick={() => pick(e.id)}
            >
              <span className="history__row-ico">
                <Icon name="history" size={15} />
              </span>
              <div className="history__row-meta">
                <span className="history__row-time">{formatTime(e.createdAt)}</span>
                <span className="history__row-sub">
                  {formatBytes(e.size)} · {e.hash.slice(0, 8)}
                </span>
              </div>
              <span className="history__row-view">View</span>
            </button>
          ))}
        </div>
        <div className="history__preview">
          <div className="history__preview-head">
            {selectedId ? (
              <>
                <Icon name="document" size={14} />
                Preview of version saved {formatTime(
                  entries.find((e) => e.id === selectedId)?.createdAt ?? ""
                )}
              </>
            ) : (
              "Select a version to preview its contents"
            )}
          </div>
          {preview !== null ? (
            <pre className="history__code">
              <code>{preview}</code>
            </pre>
          ) : selectedId ? (
            <div className="history__state">
              <span className="spinner" /> Loading…
            </div>
          ) : (
            <div className="history__placeholder">
              <Icon name="history" size={34} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
