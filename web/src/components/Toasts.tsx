import { useApp } from "../store";
import { Icon, type IconName } from "./Icon";
import { classNames } from "../lib/format";

const kindIcon: Record<string, IconName> = {
  success: "check",
  error: "warning",
  warn: "warning",
  info: "pulse",
};

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={classNames("toast", `toast--${t.kind}`)}
          onClick={() => dismissToast(t.id)}
        >
          <span className="toast__icon">
            <Icon name={kindIcon[t.kind] ?? "pulse"} size={16} />
          </span>
          <span className="toast__msg">{t.message}</span>
          <button className="toast__close" aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
