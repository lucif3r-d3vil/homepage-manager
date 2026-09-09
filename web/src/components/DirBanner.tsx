import { useApp } from "../store";
import { Icon } from "./Icon";

export function DirBanner() {
  const { directoryUnavailable, configDir, openSetup } = useApp();
  if (!directoryUnavailable || (directoryUnavailable.exists && directoryUnavailable.writable))
    return null;

  return (
    <div className="dir-banner">
      <span className="dir-banner__icon">
        <Icon name="warning" size={18} />
      </span>
      <div className="dir-banner__text">
        <strong>Configuration directory unavailable</strong>
        <span>
          {directoryUnavailable.message ??
            "The configured directory cannot be read or written right now."}{" "}
          <code>{configDir}</code>
        </span>
      </div>
      <button className="btn btn--ghost btn--sm" onClick={openSetup}>
        Change directory
      </button>
    </div>
  );
}
