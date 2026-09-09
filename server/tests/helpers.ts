import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TempEnv {
  root: string;
  configDir: string;
  dataDir: string;
}

export async function makeTempEnv(): Promise<TempEnv> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hpm-test-"));
  const configDir = path.join(root, "homepage-config");
  const dataDir = path.join(root, "data");
  await fs.mkdir(configDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
  return { root, configDir, dataDir };
}

export async function cleanup(env: TempEnv): Promise<void> {
  try {
    await fs.rm(env.root, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** Write a sample set of Homepage config files into configDir. */
export async function seedHomepage(configDir: string): Promise<void> {
  await fs.writeFile(
    path.join(configDir, "services.yaml"),
    "---\n- My Group:\n    - My Service:\n        href: http://localhost/\n        description: Test\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(configDir, "bookmarks.yaml"),
    "---\n- Developer:\n    - Github:\n        - abbr: GH\n          href: https://github.com\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(configDir, "settings.yaml"),
    "# settings.yaml\n\nlanguage: en\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(configDir, "widgets.yaml"),
    "providers:\n  openweathermap:\n    apiKey: '{{HOMEPAGE_VAR_WEATHER_API_KEY}}'\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(configDir, "custom.css"),
    ":root {\n  --theme-primary: #8b7bff;\n}\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(configDir, "custom.js"),
    "console.log('homepage ready');\n",
    "utf8"
  );
}
