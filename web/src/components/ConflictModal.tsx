import { useApp } from "../store";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function ConflictModal() {
  const { conflict, resolveConflict, dismissConflict, docs } = useApp();
  if (!conflict) return null;
  const localDoc = docs[conflict.path];

  return (
    <Modal
      title="Save conflict"
      icon={<Icon name="warning" size={17} />}
      onClose={dismissConflict}
      size="md"
      footer={
        <div className="conflict__foot">
          <button className="btn btn--ghost" onClick={dismissConflict}>
            Go back to editor
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => resolveConflict(false)}
          >
            Discard mine & load on-disk
          </button>
          <button
            className="btn btn--primary"
            onClick={() => resolveConflict(true)}
          >
            Overwrite on-disk version
          </button>
        </div>
      }
    >
      <div className="conflict">
        <div className="conflict__lead">
          <strong>{conflict.path}</strong> was modified on disk after you opened it
          (or while you were editing).
        </div>
        <div className="conflict__two">
          <div className="conflict__col">
            <div className="conflict__col-head is-local">
              <span className="conflict__dot" />
              Your unsaved changes
            </div>
            <pre className="conflict__code">
              <code>{conflict.attempted}</code>
            </pre>
          </div>
          <div className="conflict__col">
            <div className="conflict__col-head is-disk">
              <span className="conflict__dot" />
              Current version on disk
            </div>
            <pre className="conflict__code">
              <code>{conflict.currentContent}</code>
            </pre>
          </div>
        </div>
        <p className="conflict__note">
          {localDoc?.dirty ? (
            <>
              You have unsaved edits in this file. Choosing{" "}
              <b>“Overwrite on-disk version”</b> replaces what's on disk with your
              editor content.
            </>
          ) : (
            <>The editor will not overwrite silently — pick which version to keep.</>
          )}
        </p>
      </div>
    </Modal>
  );
}
