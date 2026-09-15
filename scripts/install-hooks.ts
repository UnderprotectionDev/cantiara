const gitRepository = Bun.spawnSync(
  ["git", "rev-parse", "--is-inside-work-tree"],
  {
    stderr: "ignore",
    stdout: "ignore",
  },
);

if (gitRepository.exitCode === 0) {
  const lefthook = Bun.spawnSync(["lefthook", "install"], {
    stderr: "inherit",
    stdout: "inherit",
  });

  if (lefthook.exitCode !== 0) {
    process.exit(lefthook.exitCode);
  }
}
