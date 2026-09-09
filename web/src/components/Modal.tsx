import { useEffect, type ReactNode } from "react";
import { classNames } from "../lib/format";

export function Modal({
  title,
  icon,
  onClose,
  children,
  footer,
  size = "md",
  closable = true,
}: {
  title: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closable?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closable && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closable, onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose && closable ? onClose : undefined}>
      <div
        className={classNames("modal", `modal--${size}`)}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal__head">
          <div className="modal__title">
            {icon && <span className="modal__title-icon">{icon}</span>}
            <h2>{title}</h2>
          </div>
          {closable && onClose && (
            <button className="iconbtn" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}
