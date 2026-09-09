import yaml from "js-yaml";
import type {
  EditorLanguage,
  ValidateIssue,
  ValidateResponse,
} from "@homepage-manager/shared";

/** Return whether this language/kinds needs YAML parsing. */
export function needsYamlValidation(language: EditorLanguage): boolean {
  return language === "yaml";
}

/**
 * Validate that a string parses as YAML. Only YAML files are strictly validated;
 * CSS/JS are returned as valid (a full syntax check is out of scope here).
 */
export function validateContent(
  content: string,
  language: EditorLanguage
): ValidateResponse {
  if (!needsYamlValidation(language)) {
    return { valid: true, issues: [] };
  }
  return validateYaml(content);
}

export function validateYaml(content: string): ValidateResponse {
  if (!content.trim()) {
    return { valid: true, issues: [] };
  }
  try {
    // `load` with the default schema; template placeholders such as
    // "{{HOMEPAGE_VAR}}" are legal YAML content and pass.
    yaml.load(content);
    return { valid: true, issues: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const mark = (err as { mark?: { line: number; column: number } }).mark;
    const issue: ValidateIssue = {
      type: "error",
      message,
      line: mark ? mark.line + 1 : undefined,
      column: mark ? mark.column + 1 : undefined,
    };
    return { valid: false, issues: [issue] };
  }
}
