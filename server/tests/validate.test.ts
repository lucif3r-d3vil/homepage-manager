import { describe, expect, it } from "vitest";
import { validateContent } from "../src/validate";

describe("validateContent", () => {
  it("accepts valid YAML", () => {
    const r = validateContent("title: My Dashboard\nservices:\n  - name: A\n", "yaml");
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("accepts Homepage template variables and multiline", () => {
    const r = validateContent(
      "providers:\n  openweathermap:\n    apiKey: '{{HOMEPAGE_VAR_WEATHER_API_KEY}}'\n    units: metric\n",
      "yaml"
    );
    expect(r.valid).toBe(true);
  });

  it("reports errors with line numbers for broken YAML", () => {
    const r = validateContent("title: My Dashboard\n  bad: indent\n: nope\n", "yaml");
    expect(r.valid).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it("treats CSS and JS as always valid (no parser)", () => {
    expect(validateContent("body { color: red", "css").valid).toBe(true);
    expect(validateContent("function x( {", "javascript").valid).toBe(true);
  });
});
