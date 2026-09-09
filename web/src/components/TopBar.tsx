import { useApp } from "../store";
import { Icon } from "./Icon";
import { ConnectionBadge } from "./StatusPill";

export function TopBar() {
  const { configured, configDir, dirtyCount, connected, openSetup } = useApp();

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">
          <Icon name="logo" size={24} />
        </span>
        <div className="topbar__titles">
          <span className="topbar__name">Homepage Manager</span>
          <span className="topbar__sub">for gethomepage.dev dashboards</span>
        </div>
      </div>

      <div className="topbar__right">
        {configured && (
          <button className="chip chip--dir" onClick={openSetup} title="Change configuration directory">
            <Icon name="folderOpen" size={13} />
            <span className="chip--dir-path" title={configDir}>
              {configDir}
            </span>
          </button>
        )}
        {dirtyCount > 0 && (
          <span className="chip chip--warn" title="Files with unsaved changes">
            <span className="chip__dot" />
            {dirtyCount} unsaved
          </span>
        )}
        <ConnectionBadge connected={connected} />
      </div>
    </header>
  );
}
