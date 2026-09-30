export function developmentCommand(arguments_: string[]) {
  const argumentsCopy = [...arguments_];
  const [first] = argumentsCopy;
  const task =
    first === "server" || first === "dev" ? argumentsCopy.shift() : "dev";
  if (argumentsCopy[0] === "--") {
    argumentsCopy.shift();
  }
  const informational = argumentsCopy.some((argument) =>
    ["--help", "-h", "--version"].includes(argument),
  );
  const command = ["./node_modules/.bin/turbo", "run", "dev"];
  if (task === "server") {
    command.push("-F", "server");
    if (!informational) {
      command.push("--");
    }
  } else if (!informational) {
    command.push(
      "--ui=tui",
      "--filter=fumadocs",
      "--filter=server",
      "--filter=web",
      "--filter=extension",
      "--filter=@cantiara/api",
    );
  }
  command.push(...argumentsCopy);
  return { command, requiresDatabase: !informational };
}
