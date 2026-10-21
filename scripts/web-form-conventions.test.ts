import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const biome = join(root, "node_modules", ".bin", "biome");
const featureRoot = "apps/web/src/features/";
const formPlugin = "./scripts/biome/web-form-uses-tanstack-form.grit";
const controlPlugin = "./scripts/biome/web-control-uses-cantiara-ui.grit";
const folders: string[] = [];

interface BiomeOverride {
  includes?: string[];
  plugins?: string[];
}

interface BiomeDiagnostic {
  category: string;
  location: { path: string };
}

afterEach(() => {
  for (const folder of folders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

function temporaryFolder() {
  const folder = mkdtempSync(join(tmpdir(), "cantiara-web-form-"));
  folders.push(folder);
  return folder;
}

function flaggedFiles(plugin: string, cwd: string, paths: string[]) {
  const config = temporaryFolder();
  writeFileSync(
    join(config, "biome.json"),
    JSON.stringify({
      linter: { rules: { recommended: false } },
      plugins: [join(root, plugin)],
    }),
  );
  const result = spawnSync(
    biome,
    [
      "lint",
      `--config-path=${config}`,
      "--reporter=json",
      "--max-diagnostics=none",
      ...paths,
    ],
    { cwd, encoding: "utf8" },
  );
  if (!result.stdout) {
    throw new Error(result.stderr);
  }
  const report: { diagnostics: BiomeDiagnostic[] } = JSON.parse(result.stdout);
  return [
    ...new Set(
      report.diagnostics
        .filter((diagnostic) => diagnostic.category === "plugin")
        .map((diagnostic) => diagnostic.location.path),
    ),
  ].sort();
}

function flaggedFixtures(plugin: string, fixtures: Record<string, string>) {
  const folder = temporaryFolder();
  for (const [name, source] of Object.entries(fixtures)) {
    writeFileSync(join(folder, name), source);
  }
  return flaggedFiles(plugin, folder, Object.keys(fixtures));
}

function featureOverride(plugin: string) {
  const config: { overrides: BiomeOverride[] } = JSON.parse(
    readFileSync(join(root, "biome.json"), "utf8"),
  );
  const overrides = config.overrides.filter((override) =>
    override.plugins?.includes(plugin),
  );
  if (overrides.length !== 1) {
    throw new Error(`Expected one biome.json override for ${plugin}`);
  }
  return overrides[0]?.includes ?? [];
}

describe("Web Form TanStack Form convention", () => {
  test("flags a rendered form without a TanStack Form hook", () => {
    expect(
      flaggedFixtures(formPlugin, {
        "state-form.tsx": `import { useState } from "react";
export function StateForm() {
  const [title, setTitle] = useState("");
  return (
    <form
      className="grid"
      onSubmit={() => setTitle(title)}
    >
      <span>{title}</span>
    </form>
  );
}
`,
        "tanstack-form.tsx": `import { useForm } from "@tanstack/react-form";
export function TanStackForm() {
  const form = useForm({ defaultValues: { title: "" } });
  return <form onSubmit={() => form.handleSubmit()} />;
}
`,
        "wrapped-form.tsx": `import { useWorkTemplateForm } from "./use-work-template-form";
export function WrappedForm() {
  const form = useWorkTemplateForm();
  return <form onSubmit={() => form.handleSubmit()}><span /></form>;
}
`,
        "no-form.tsx": `export function NoForm() {
  return <section><span /></section>;
}
`,
      }),
    ).toEqual(["state-form.tsx"]);
  });

  test("flags raw controls instead of @cantiara/ui controls", () => {
    expect(
      flaggedFixtures(controlPlugin, {
        "raw-input.tsx": `export const RawInput = () => (
  <input
    value="title"
  />
);
`,
        "raw-textarea.tsx":
          "export const RawTextarea = () => <textarea>note</textarea>;\n",
        "raw-select.tsx": `export const RawSelect = () => (
  <select value="a">
    <option value="a">A</option>
  </select>
);
`,
        "ui-controls.tsx": `import { Input } from "@cantiara/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
export const UiControls = () => (
  <div>
    <Input value="title" />
    <Textarea value="note" />
    <NativeSelect value="a"><NativeSelectOption value="a">A</NativeSelectOption></NativeSelect>
  </div>
);
`,
      }),
    ).toEqual(["raw-input.tsx", "raw-select.tsx", "raw-textarea.tsx"]);
  });
});

describe.each([formPlugin, controlPlugin])("%s", (plugin) => {
  test("applies to every web feature source file without exemptions", () => {
    expect(featureOverride(plugin)).toEqual([
      `${featureRoot}**`,
      "!**/*.test.tsx",
    ]);
  });
});

test("web feature source keeps convention plugins unsuppressed", () => {
  const result = spawnSync(
    "git",
    ["grep", "-n", "-E", "biome-ignore[^:]*plugin", "--", featureRoot],
    { cwd: root, encoding: "utf8" },
  );
  expect(result.stdout).toBe("");
});
