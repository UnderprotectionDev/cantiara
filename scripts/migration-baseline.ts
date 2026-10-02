import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPathPattern = /^(?:[^/]+\.sql|meta\/[^/]+\.json)$/;

export function git(root: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20_000_000,
  }).trim();
}

export function migrationBaseline(
  root: string,
  ref: string | undefined,
  securityEvents: boolean,
) {
  const directory = `packages/db/src/migrations${securityEvents ? "/security-events" : ""}`;
  const belongs = (path: string) => migrationPathPattern.test(path);
  const paths = ref
    ? git(root, "ls-tree", "-r", "--name-only", ref, "--", directory)
        .split("\n")
        .map((path) => path.slice(directory.length + 1))
        .filter(belongs)
    : [
        ...readdirSync(join(root, directory)),
        ...readdirSync(join(root, directory, "meta")).map(
          (name) => `meta/${name}`,
        ),
      ].filter(belongs);
  const files = new Map<string, Buffer>();
  const digest = createHash("sha256").update(
    "cantiara-migration-baseline-v1\0",
  );
  for (const path of paths.sort()) {
    const content = ref
      ? execFileSync("git", ["show", `${ref}:${directory}/${path}`], {
          cwd: root,
          maxBuffer: 20_000_000,
        })
      : readFileSync(join(root, directory, path));
    files.set(path, content);
    digest.update(`${path}\0${content.length}\0`).update(content);
  }
  if (!files.has("meta/_journal.json")) {
    throw new Error("Canonical Git baseline has no migration journal");
  }
  return { files, fingerprint: digest.digest("hex") };
}
