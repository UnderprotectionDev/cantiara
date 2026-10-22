import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { readConventionRules } from "./convention-rules";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = join(root, "scripts", "check-conventions.ts");
const realStructure = readFileSync(join(root, "structure.md"), "utf8");
const realStack = readFileSync(join(root, "docs", "tech-stack.md"), "utf8");
const feature = "apps/web/src/features/notes";

const LEGACY_EDITOR = `import { Input } from "@cantiara/ui/components/input";
import { useState } from "react";

export function LegacyNoteEditor({ save }: { save: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(title);
      }}
    >
      <Input onChange={(event) => setTitle(event.target.value)} value={title} />
    </form>
  );
}
`;

let repository: string;

function git(...args: string[]) {
  const result = spawnSync(
    "git",
    ["-c", "user.email=check@example.com", "-c", "user.name=check", ...args],
    { cwd: repository, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

function write(path: string, content: string) {
  const file = join(repository, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function check() {
  git("add", "-A");
  const result = spawnSync("bun", [cli, "--staged"], {
    cwd: repository,
    encoding: "utf8",
  });
  return { exitCode: result.status, output: result.stderr };
}

beforeEach(() => {
  repository = mkdtempSync(join(tmpdir(), "cantiara-conventions-"));
  git("init", "-q");
  write("structure.md", realStructure);
  write("docs/tech-stack.md", realStack);
  write(`${feature}/ui/components/legacy-note-editor.tsx`, LEGACY_EDITOR);
  write(
    "package.json",
    `${JSON.stringify({ dependencies: { react: "^19.0.0" }, name: "fixture" }, null, 2)}\n`,
  );
  git("add", "-A");
  git("commit", "-qm", "base");
});

afterEach(() => {
  rmSync(repository, { force: true, recursive: true });
});

describe("deliberate violations are caught", () => {
  test("a form that keeps each input in useState", () => {
    write(
      `${feature}/ui/forms/note-form.tsx`,
      `import { Input } from "@cantiara/ui/components/input";
import { useState } from "react";

export function NoteForm({ save }: { save: (title: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(title);
      }}
    >
      <Input onChange={(event) => setTitle(event.target.value)} value={title} />
      <textarea onChange={(event) => setBody(event.target.value)} value={body} />
    </form>
  );
}
`,
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(1);
    expect(output).toContain("[form-state] Form field `title`");
    expect(output).toContain("[form-state] Form field `body`");
    expect(output).toContain("[raw-control] Use `@cantiara/ui` `Textarea`");
    expect(output).toContain("[form-library]");
    expect(output).toContain("docs/tech-stack.md › TanStack Form");
  });

  test("a file without JSX under ui/", () => {
    write(
      `${feature}/ui/components/note-labels.ts`,
      "export const noteLabel = (count: number) => String(count);\n",
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(1);
    expect(output).toContain(
      "note-labels.ts:1 [ui-jsx] `ui/components/` holds JSX",
    );
  });

  test("files outside the tree, misnamed views and loose tests", () => {
    write(`${feature}/note-helpers.ts`, "export const helper = 1;\n");
    write(
      `${feature}/ui/views/notes.tsx`,
      "export const Notes = () => <main />;\n",
    );
    write(
      `${feature}/lib/note-labels.test.ts`,
      'import { test } from "vitest";\ntest("label", () => {});\n',
    );
    write(`${feature}/lib/index.ts`, 'export * from "./note-labels";\n');
    const { exitCode, output } = check();
    expect(exitCode).toBe(1);
    expect(output).toContain("[folder] `note-helpers.ts` is outside");
    expect(output).toContain("[file-name] Files in `ui/views/` are named");
    expect(output).toContain("[test-home] Move the test into `lib/tests/`");
    expect(output).toContain("[barrel]");
  });

  test("imports across feature boundaries", () => {
    write(
      `${feature}/hooks/use-note-owner.ts`,
      `import { useContact } from "@/features/contacts/hooks/use-contact";
import { contactLabel } from "@/features/contacts/lib/contact-labels";
import { useProject } from "@/features/project-shell/hooks/use-project";
import { ProjectView } from "@/features/project-shell/ui/views/project-view";
import { app } from "../../../../../server/src/app";

export const useNoteOwner = () => [useContact, contactLabel, useProject, ProjectView, app];
`,
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(1);
    expect(output).toContain(
      "another feature's `hooks/` (`@/features/contacts/hooks/use-contact`)",
    );
    expect(output).toContain(
      "Shell feature `project-shell` may be imported except its `ui/views/`",
    );
    expect(output).toContain("The web app never imports server source");
    expect(output).not.toContain("contacts/lib/contact-labels");
    expect(output).not.toContain("project-shell/hooks/use-project");
  });

  test("a dependency the stack rejects or does not own", () => {
    write(
      "package.json",
      `${JSON.stringify(
        {
          dependencies: {
            "@tanstack/react-pacer": "^1.0.0",
            express: "^5.0.0",
            "left-pad": "^1.3.0",
            react: "^19.0.0",
          },
          name: "fixture",
        },
        null,
        2,
      )}\n`,
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(1);
    expect(output).toContain("`express` is Express");
    expect(output).toContain("`left-pad` has no owner in docs/tech-stack.md");
    expect(output).not.toContain("react-pacer");
    expect(output).not.toContain("`react`");
  });

  test("hand-built equivalents of oRPC, Clipboard, T3 Env and Evlog", () => {
    write(
      `${feature}/hooks/use-note-sync.ts`,
      `export function useNoteSync() {
  return fetch("/rpc/listNotes").then((response) => response.json());
}
`,
    );
    write(
      `${feature}/lib/copy-note.ts`,
      "export const copyNote = (text: string) => navigator.clipboard.writeText(text);\n",
    );
    write(
      "apps/server/src/features/notes/server/note-audit.ts",
      `export function audit() {
  console.log(process.env.NOTE_AUDIT);
}
`,
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(1);
    expect(output).toContain("[raw-fetch] oRPC owns this responsibility");
    expect(output).toContain("[raw-clipboard] Browser Clipboard API owns");
    expect(output).toContain("[console-logging] Evlog owns");
    expect(output).toContain("[raw-process-env] T3 Env owns");
    expect(output).toContain("docs/tech-stack.md › Evlog");
  });
});

describe("compliant changes and documented exceptions pass", () => {
  test("a TanStack Form built from @cantiara/ui controls", () => {
    write(
      `${feature}/lib/note-form-schema.ts`,
      `import { z } from "zod";

export const noteFormSchema = z.object({ title: z.string().min(1) });
`,
    );
    write(
      `${feature}/ui/forms/note-title-form.tsx`,
      `import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { noteFormSchema } from "../../lib/note-form-schema";

export function NoteTitleForm({ save }: { save: (title: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: ({ value }) => {
      const parsed = noteFormSchema.safeParse(value);
      if (!parsed.success) {
        setError("Title is required.");
        return;
      }
      save(parsed.data.title);
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <Input
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
`,
    );
    write(
      `${feature}/ui/forms/tests/note-title-form.test.tsx`,
      'import { test } from "vitest";\ntest("saves", () => {});\n',
    );
    const { exitCode, output } = check();
    expect(output).toContain("0 new violation(s)");
    expect(exitCode).toBe(0);
  });

  test("the documented owners of those responsibilities pass", () => {
    write(
      "apps/web/src/lib/clipboard.ts",
      "export const copy = (text: string) => navigator.clipboard.writeText(text);\n",
    );
    write("apps/server/src/env.ts", "export const port = process.env.PORT;\n");
    write(
      "apps/server/src/smart-link-egress-env.ts",
      "export const port = process.env.PORT;\n",
    );
    write(
      `${feature}/hooks/use-note-sync.ts`,
      'import { client } from "@/utils/orpc";\nexport const useNoteSync = () => client;\n',
    );
    write(
      "apps/server/src/features/notes/server/tests/note-audit.test.ts",
      'import { test } from "vitest";\ntest("logs", () => { console.log(process.env.X); });\n',
    );
    const { exitCode, output } = check();
    expect(output).toContain("0 new violation(s)");
    expect(exitCode).toBe(0);
  });

  test("an existing Approved exception folder", () => {
    write(
      "apps/web/src/features/screens/engine/scene-graph.ts",
      "export const sceneGraph = new Map<string, string>();\n",
    );
    const { exitCode, output } = check();
    expect(output).toContain("0 new violation(s)");
    expect(exitCode).toBe(0);
  });

  test("an exception recorded with its reason in the same change", () => {
    write(
      "structure.md",
      realStructure.replace(
        "- `screens/engine/`",
        "- `notes/sync/` (offline replay queue without React).\n- `screens/engine/`",
      ),
    );
    write(
      `${feature}/sync/replay-queue.ts`,
      "export const queue: string[] = [];\n",
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(0);
    expect(output).toContain(
      "review structure.md:1 [approved-exception] New Approved exception `notes/sync/` (offline replay queue without React)",
    );
  });

  test("editing a legacy deviation without adding one", () => {
    write(
      `${feature}/ui/components/legacy-note-editor.tsx`,
      LEGACY_EDITOR.replace("<Input", '<Input aria-label="Title"'),
    );
    expect(check()).toMatchObject({ exitCode: 0 });
  });

  test("a stack exclusion with a stated case only asks for review", () => {
    write(
      "apps/fumadocs/package.json",
      `${JSON.stringify({ dependencies: { next: "^16.0.0" }, name: "fumadocs" }, null, 2)}\n`,
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(0);
    expect(output).toContain(
      "review apps/fumadocs/package.json:3 [dependency]",
    );
  });

  test("a new feature folder is surfaced for judgment, not failed", () => {
    write(
      "apps/web/src/features/reading-list/ui/views/reading-list-view.tsx",
      "export const ReadingListView = () => <main />;\n",
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(0);
    expect(output).toContain("[new-feature] New feature folder `reading-list`");
  });
});

describe("existing deviations do not hide new ones", () => {
  test("a new useState field in a legacy file fails alone", () => {
    write(
      `${feature}/ui/components/legacy-note-editor.tsx`,
      LEGACY_EDITOR.replace(
        '  const [title, setTitle] = useState("");',
        '  const [title, setTitle] = useState("");\n  const [tag, setTag] = useState("");',
      ).replace(
        "    </form>",
        "      <Input onChange={(event) => setTag(event.target.value)} value={tag} />\n    </form>",
      ),
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(1);
    expect(output).toContain("Form field `tag`");
    expect(output).not.toContain("Form field `title`");
  });

  test("moving a legacy file keeps its existing content deviations", () => {
    mkdirSync(join(repository, feature, "ui", "forms"));
    git(
      "mv",
      `${feature}/ui/components/legacy-note-editor.tsx`,
      `${feature}/ui/forms/legacy-note-form.tsx`,
    );
    const { exitCode, output } = check();
    expect(output).not.toContain("[form-state]");
    expect(exitCode).toBe(0);
  });
});

describe("rules come from the documents", () => {
  test("removing a control from the TanStack Form row stops enforcing it", () => {
    write(
      `${feature}/ui/components/note-color.tsx`,
      'export const NoteColor = () => <input type="color" />;\n',
    );
    expect(check().output).toContain("[raw-control]");

    write(
      "docs/tech-stack.md",
      realStack.replace(
        "metin, `file` ve `color` için",
        "metin ve `file` için",
      ),
    );
    const { exitCode, output } = check();
    expect(output).not.toContain("[raw-control]");
    expect(exitCode).toBe(0);
  });

  test("removing a ban sentence from the stack row stops enforcing it", () => {
    write(
      `${feature}/hooks/use-note-sync.ts`,
      'export const load = () => fetch("/rpc/listNotes");\n',
    );
    expect(check().output).toContain("[raw-fetch]");

    write(
      "docs/tech-stack.md",
      realStack.replace("API'yi ham `fetch` ile çağırmaz", "API'yi çağırır"),
    );
    const { exitCode, output } = check();
    expect(output).not.toContain("[raw-fetch]");
    expect(exitCode).toBe(0);
    expect(output).toContain("[rule-removed] The oRPC sentence");
  });

  test("a folder added to the tree is accepted with its name pattern", () => {
    write(
      "structure.md",
      realStructure.replace(
        "  store/           feature-owned client state\n",
        "  store/           feature-owned client state\n  workers/         no JSX: <name>-worker.ts\n",
      ),
    );
    write(`${feature}/workers/sync-worker.ts`, "export const worker = 1;\n");
    write(`${feature}/workers/sync.ts`, "export const misnamed = 1;\n");
    const { exitCode, output } = check();
    expect(exitCode).toBe(1);
    expect(output).not.toContain("sync-worker.ts");
    expect(output).toContain(
      "workers/sync.ts:1 [file-name] Files in `workers/` are named `<name>-worker.ts`",
    );
  });

  test("an exception without a reason fails as a document error", () => {
    write(
      "structure.md",
      realStructure.replace(
        "- `screens/engine/`",
        "- `notes/sync/`\n- `screens/engine/`",
      ),
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(2);
    expect(output).toContain(
      "structure.md: Approved exception `notes/sync/` has no reason in parentheses",
    );
  });

  test("a section the check cannot read fails loudly", () => {
    write(
      "docs/tech-stack.md",
      realStack.replace("| TanStack Form |", "| TanStack Forms |"),
    );
    const { exitCode, output } = check();
    expect(exitCode).toBe(2);
    expect(output).toContain('the "| TanStack Form |" table row is missing');
  });

  test("the repository documents are readable", () => {
    const rules = readConventionRules((path) =>
      readFileSync(join(root, path), "utf8"),
    );
    expect(rules.structure.web.folders.map((entry) => entry.folder)).toEqual([
      "ui/views/",
      "ui/components/",
      "ui/forms/",
      "hooks/",
      "lib/",
      "store/",
    ]);
    expect(rules.structure.imports).toMatchObject({
      forbiddenFolders: ["ui/", "hooks/", "store/", "server/"],
      shellExceptFolder: "ui/views/",
      shellFeatures: ["web-macos-client", "project-shell"],
      webNeverImportsServer: true,
    });
    expect(
      rules.structure.approvedExceptions.map((entry) => entry.path),
    ).toEqual(["screens/engine/", "screens/output/"]);
    expect(
      rules.stack.forms.controls.flatMap((entry) => entry.components),
    ).toEqual([
      "Input",
      "Textarea",
      "NativeSelect",
      "Select",
      "Checkbox",
      "RadioGroup",
    ]);
  });
});
