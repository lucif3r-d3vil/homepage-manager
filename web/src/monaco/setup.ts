import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

type WorkerLabel =
  | "json"
  | "css"
  | "scss"
  | "less"
  | "html"
  | "handlebars"
  | "razor"
  | "typescript"
  | "javascript";

(globalThis as unknown as { MonacoEnvironment: object }).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    switch (label as WorkerLabel) {
      case "json":
        return new JsonWorker();
      case "css":
      case "scss":
      case "less":
        return new CssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new HtmlWorker();
      case "typescript":
      case "javascript":
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};

loader.config({ monaco });

// A dark, glassy editor theme tuned to the rest of the app.
monaco.editor.defineTheme("opus-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6e7690", fontStyle: "italic" },
    { token: "keyword", foreground: "c792ea" },
    { token: "key", foreground: "7ee0d6" },
    { token: "string", foreground: "f6c177" },
    { token: "number", foreground: "f78c6c" },
    { token: "type.identifier", foreground: "5ad0ff" },
    { token: "predefined", foreground: "5ad0ff" },
    { token: "tag", foreground: "82aaff" },
    { token: "meta.rule", foreground: "6e7690" },
    { token: "delimiter", foreground: "8a91ab" },
    { token: "delimiter.bracket", foreground: "8a91ab" },
  ],
  colors: {
    "editor.background": "#00000000",
    "editor.foreground": "#e6e9f2",
    "editorLineNumber.foreground": "#4a5070",
    "editorLineNumber.activeForeground": "#9aa2c0",
    "editorCursor.foreground": "#8b7bff",
    "editor.selectionBackground": "#5b5bd633",
    "editor.inactiveSelectionBackground": "#5b5bd622",
    "editor.lineHighlightBackground": "#ffffff08",
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background1": "#2a2f45",
    "editorIndentGuide.activeBackground1": "#434a6b",
    "editorWidget.background": "#171a29",
    "editorWidget.border": "#2a2f45",
    "editorGutter.background": "#00000000",
    "editorError.foreground": "#ff7a90",
    "editorWarning.foreground": "#f6c177",
    "editorWhitespace.foreground": "#2c3150",
    "editorBracketMatch.background": "#8b7bff33",
    "editorBracketMatch.border": "#8b7bff",
    "scrollbarSlider.background": "#3a416433",
    "scrollbarSlider.hoverBackground": "#4a5277aa",
    "scrollbarSlider.activeBackground": "#8b7bff88",
    "editorOverviewRuler.border": "#00000000",
    "minimap.background": "#00000000",
  },
});

export { monaco };

/** Register a lightweight YAML language with syntax highlighting. */
export function registerYaml(): void {
  if (monaco.languages.getLanguages().some((l) => l.id === "yaml")) {
    return;
  }
  monaco.languages.register({
    id: "yaml",
    extensions: [".yaml", ".yml"],
    aliases: ["YAML", "yaml"],
  });

  const monarch: unknown = {
    defaultToken: "",
    tokenPostfix: ".yaml",
    tokenizer: {
      root: [
        [/^#.*$/, "comment"],
        [/^#\s*region\b.*$/, "comment"],
        [/[ \t\r\n]+/, "white"],
        [/^---+$/, "meta.rule"],
        [/^\.\.\.$/, "meta.rule"],
        // Keys: "name:" or 'name:'
        [/(^|\s)(&[A-Za-z0-9_-]+|\*[A-Za-z0-9_-]+)/, "type.identifier"],
        [/\{\{[\w.:\s-]+\}\}|\$[A-Za-z_][\w]*/, "predefined"],
        [/^\s*(?:-\s*)?("[^"]*"|'[^']*'|[\w./@_-]+)(?=\s*:)/, "key"],
        [/-{3}\s*$/, "meta"],
        [/-[^\n:]+(?=\s*:)/, "key"],
        [/\b(true|True|TRUE|false|False|FALSE)\b/, "keyword"],
        [/\b(null|Null|NULL|~)\b/, "keyword.constant"],
        [/\b(0x[0-9a-fA-F]+|0o[0-7]+|[+-]?[0-9][0-9_]*(\.[0-9_]*)?)\b/, "number"],
        [/[|>][+-]?$/, "operator"],
        [/"(?:[^"\\]|\\.)*"/, "string"],
        [/'(?:[^'\\]|\\.)*'/, "string"],
        [/[\[{}\],]/, "@brackets"],
        [/[:\-]/, "delimiter"],
        [/[A-Za-z_][\w-]*/, "identifier"],
      ],
    },
  };

  monaco.languages.setMonarchTokensProvider(
    "yaml",
    monarch as monaco.languages.IMonarchLanguage
  );

  monaco.languages.setLanguageConfiguration("yaml", {
    comments: { lineComment: "#" },
    brackets: [
      ["{", "}"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      offSide: true,
      markers: {
        start: /^\s*(#\s*region\b|&)/,
        end: /^\s*#\s*endregion\b/,
      },
    },
  });
}
