import { classNames } from "../lib/format";
import { Icon } from "./Icon";

export function StatusPill({
  ok,
  label,
  sub,
}: {
  ok: boolean;
  label: string;
  sub?: string;
}) {
  return (
    <span
      className={classNames("status-pill", ok ? "is-ok" : "is-off")}
      title={sub}
    >
      <span className="status-dot" />
      {label}
    </span>
  );
}

export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={classNames(
        "conn",
        connected ? "conn--on" : "conn--off"
      )}
      title={
        connected
          ? "Live: watching for external file changes"
          : "Live file watch disconnected — reconnecting"
      }
    >
      <span className="conn__dot" />
      {connected ? "Live" : "Offline"}
      <Icon name="pulse" size={13} />
    </span>
  );
}
