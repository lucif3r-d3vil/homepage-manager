import { useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { classNames } from "../lib/format";

const SAMPLES = [
  { n: "services.yaml", icon: "yaml" as const },
  { n: "bookmarks.yaml", icon: "yaml" as const },
  { n: "settings.yaml", icon: "yaml" as const },
  { n: "widgets.yaml", icon: "yaml" as const },
  { n: "custom.css", icon: "css" as const },
  { n: "custom.js", icon: "js" as const },
];

export function SetupWizard() {
  const { configDir, configured, requestSetup, closeSetup, toast } = useApp();
  const [value, setValue] = useState(configDir ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const path = value.trim();
    if (!path) {
      setError("Enter the path to your Homepage configuration directory.");
      return;
    }
    if (path === "/") {
      setError("You cannot use the filesystem root. Choose the Homepage config folder.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestSetup(path);
      toast("success", "Connected and scanning for configuration files…");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to connect.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="setup">
      <div className="setup__card">
        <div className="setup__brand">
          <span className="setup__logo">
            <Icon name="logo" size={30} />
          </span>
          <div>
            <h1>Homepage Manager</h1>
            <p>A polished editor for your Homepage dashboard.</p>
          </div>
        </div>

        {configured ? (
          <div className="setup__reconfig">
            <span className="setup__dot" />
            Currently connected to <code>{configDir}</code>
          </div>
        ) : (
          <div className="setup__intro">
            Point the app at the folder where your Homepage configuration files
            live. Nothing outside that folder can be opened or changed.
          </div>
        )}

        <form className="setup__form" onSubmit={submit}>
          <label htmlFor="cfg-path">Homepage configuration directory</label>
          <div className={classNames("setup__input", error && "is-error")}>
            <span className="setup__input-icon">
              <Icon name="folderOpen" size={18} />
            </span>
            <input
              id="cfg-path"
              autoFocus
              value={value}
              placeholder="/homepage-config"
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
          </div>
          {error && <div className="setup__error">{error}</div>}
          <div className="setup__actions">
            {configured && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeSetup}
                disabled={busy}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? (
                <span className="spinner" />
              ) : (
                <Icon name="link" size={16} />
              )}
              {configured ? "Switch directory" : "Connect"}
            </button>
          </div>
        </form>

        <div className="setup__tip">
          <span className="setup__tip-icon">
            <Icon name="spark" size={15} />
          </span>
          <span>
            In Docker, mount your Homepage config to <code>/homepage-config</code>{" "}
            and enter that container path here.
          </span>
        </div>

        <div className="setup__files">
          <div className="setup__files-title">Files we watch for</div>
          <div className="setup__chips">
            {SAMPLES.map((s) => (
              <span key={s.n} className="chip">
                <Icon name={s.icon} size={14} />
                {s.n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
