import { useEffect, useMemo, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useApp } from "../store";
import { Icon, type IconName } from "./Icon";
import { classNames } from "../lib/format";
import { api } from "../api";
import type { ValidateIssue } from "@shared";

const kindIcon: Record<string, IconName> = {
  yaml: "yaml", yml: "yaml", css: "css", js: "js", mjs: "js", cjs: "js",
  json: "document", env: "document", txt: "document", conf: "document", toml: "document",
};

export function EditorArea() {
  const {
    activePath,
    docs,
    busy,
    activeValidation,
    validationTick,
    updateContent,
    saveActive,
    saveActiveForce,
    discardActive,
    reloadActive,
    setValidation,
    setHistoryOpen,
    toast,
  } = useApp();

  const path = activePath;
  const doc = path ? docs[path] : undefined;

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const saveRef = useRef(saveActive);
  saveRef.current = saveActive;
  const activePathRef = useRef<string | null>(null);
  activePathRef.current = path;

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      saveRef.current()
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD,
      () => editor.getAction("editor.action.deleteLines")?.run()
    );
  };

  // ---- Client-side auto-validation while typing (YAML only) ----
  useEffect(() => {
    if (!path || !doc || !doc.dirty) return;
    const isYaml = doc.meta.language === "yaml";
    const target = path;
    const t = setTimeout(() => {
      if (!isYaml) {
        setValidation({ valid: true, issues: [] });
        return;
      }
      api
        .validate(doc.content, "yaml")
        .then((res) => {
          if (activePathRef.current === target) setValidation(res);
        })
        .catch(() => {
          if (activePathRef.current === target) setValidation(null);
        });
    }, 700);
    return () => clearTimeout(t);
  }, [path, doc?.content]);

  // ---- Clear stale validation when a file becomes clean or is switched ----
  useEffect(() => {
    if (!doc?.dirty) setValidation(null);
  }, [path, doc?.dirty]);

  // ---- Push validation issues into Monaco as markers ----
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !path) return;
    const model = editor.getModel();
    if (!model) return;
    const issues = activeValidation?.issues ?? [];
    const markers = issues.map((i: ValidateIssue) => ({
      severity:
        i.type === "error"
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
      message: i.message,
      startLineNumber: i.line ?? 1,
      startColumn: i.column ?? 1,
      endLineNumber: i.line ?? model.getLineCount(),
      endColumn: Math.max((i.column ?? 1) + 1, (i.column ?? 1) + 1),
    }));
    monaco.editor.setModelMarkers(model, "homepage-manager", markers);
  }, [activeValidation, validationTick, path, doc?.content]);

  const runValidate = async () => {
    if (!path || !doc) return;
    setValidation(null);
    try {
      const res = await api.validate(doc.content, doc.meta.language);
      setValidation(res);
      if (res.valid) toast("success", `"${path}" is valid.`);
      else
        toast(
          "error",
          `"${path}" has ${res.issues.length} YAML error${res.issues.length > 1 ? "s" : ""}.`
        );
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Validation failed.");
    }
  };

  const busyPath = useMemo(() => (path && doc ? Boolean(busy[path]) : false), [path, busy]);

  if (!path || !doc) {
    return (
      <section className="editor-empty">
        <div className="editor-empty__orb">
          <Icon name="logo" size={46} />
        </div>
        <h2>Welcome back</h2>
        <p>
          Pick a configuration file from the sidebar to start editing your Homepage
          dashboard. Changes are validated and written straight to disk.
        </p>
      </section>
    );
  }

  const language = doc.meta.language;
  const issues = activeValidation?.issues ?? [];
  const errorCount = issues.filter((i) => i.type === "error").length;
  const hasIssues = issues.length > 0;
  const busySaving = busyPath;

  return (
    <section className="editor">
      <header className="editor__toolbar">
        <div className="editor__file">
          <span className={classNames("editor__file-icon", `k-${doc.meta.kind}`)}>
            <Icon name={kindIcon[doc.meta.kind] ?? "file"} size={17} />
          </span>
          <div className="editor__file-meta">
            <span className="editor__filename">
              {doc.meta.name}
              {doc.dirty && <span className="dot-dirty" title="Unsaved changes" />}
            </span>
            <span className="editor__path">
              {doc.meta.dir || "root"} · {doc.meta.kind.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="editor__actions">
          {doc.dirty && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={discardActive}
              disabled={busySaving}
            >
              Discard
            </button>
          )}
          <button
            className="btn btn--ghost btn--sm"
            onClick={reloadActive}
            disabled={busySaving}
            title="Reload from disk"
          >
            <Icon name="refresh" size={15} /> Reload
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setHistoryOpen(true)}
            title="View and restore previous versions"
          >
            <Icon name="history" size={15} /> History
          </button>
          <button
            className={classNames("btn btn--ghost btn--sm", errorCount > 0 && "is-invalid")}
            onClick={runValidate}
            disabled={busySaving}
          >
            <Icon name="check" size={15} /> Validate
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={saveActive}
            disabled={busySaving || !doc.dirty}
          >
            {busySaving ? (
              <span className="spinner spinner--sm" />
            ) : (
              <Icon name="save" size={15} />
            )}
            {busySaving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {doc.conflict && (
        <div className="conflict-banner">
          <span className="conflict-banner__icon">
            <Icon name="warning" size={16} />
          </span>
          <div className="conflict-banner__text">
            <strong>This file changed on disk</strong>
            <span>
              An external process modified <code>{doc.meta.path}</code> while you
              have unsaved edits.
            </span>
          </div>
          <div className="conflict-banner__actions">
            <button className="btn btn--ghost btn--sm" onClick={reloadActive}>
              Load on-disk version
            </button>
            <button className="btn btn--primary btn--sm" onClick={saveActiveForce}>
              Save my edits
            </button>
          </div>
        </div>
      )}

      {hasIssues && (
        <div
          className={classNames(
            "validate-strip",
            activeValidation?.valid ? "is-valid" : "is-invalid"
          )}
        >
          <span className="validate-strip__badge">
            {errorCount > 0 ? (
              <span>
                <Icon name="warning" size={13} /> {errorCount} YAML error
                {errorCount > 1 ? "s" : ""}
              </span>
            ) : (
              <span>
                <Icon name="check" size={13} /> Valid
              </span>
            )}
          </span>
          {issues.slice(0, 2).map((i, idx) => (
            <span key={idx} className="validate-strip__msg">
              {i.line ? <>Line {i.line}: </> : null}
              {i.message}
            </span>
          ))}
        </div>
      )}

      <div className="editor__monaco">
        <Editor
          height="100%"
          language={language}
          value={doc.content}
          theme="opus-dark"
          path={path}
          onMount={onMount}
          onChange={(v) => updateContent(path, v ?? "")}
          loading={<span className="spinner" />}
          options={{
            minimap: { enabled: false },
            fontSize: 13.5,
            fontFamily:
              "'SF Mono', 'JetBrains Mono', ui-monospace, 'Fira Code', Menlo, monospace",
            fontLigatures: true,
            lineHeight: 22,
            padding: { top: 16, bottom: 24 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderLineHighlight: "all",
            roundedSelection: true,
            stickyScroll: { enabled: true },
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            wordWrap: "on",
          }}
        />
      </div>
    </section>
  );
}
