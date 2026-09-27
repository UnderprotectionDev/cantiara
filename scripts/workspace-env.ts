const lineBreak = /\r?\n/;
const assignment = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/** Keep application settings while replacing the values owned by the workspace. */
export function mergeWorkspaceEnv(
  existing: string,
  owned: Record<string, string | undefined>,
) {
  const keys = new Set(Object.keys(owned));
  const preserved = existing.split(lineBreak).filter((line) => {
    const key = line.match(assignment)?.[1];
    return !(key && keys.has(key));
  });
  while (preserved.at(-1) === "") {
    preserved.pop();
  }
  const replacements = Object.entries(owned).map(
    ([key, value]) => `${key}=${JSON.stringify(value)}`,
  );
  return `${[...preserved, ...replacements].join("\n")}\n`;
}
