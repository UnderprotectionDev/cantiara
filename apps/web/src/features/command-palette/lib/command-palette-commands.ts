export const COMMAND_PALETTE_COMMAND_SHORTCUT = "Enter" as const;
export const COMMAND_PALETTE_MAX_VISIBLE_ITEMS = 50;
const COMMAND_QUERY_TOKEN_PATTERN = /\s+/;

export type CommandPaletteAction = () => void | Promise<void>;

export interface CommandPaletteRecord {
  authorized?: boolean;
  id: string;
  scope: string;
  title: string;
  type: string;
  visibleCounterpart: string;
}

export interface CommandPaletteProject {
  authorized?: boolean;
  id: string;
  name: string;
  visibleCounterpart: string;
}

export interface CommandPaletteCreateOption {
  authorized?: boolean;
  id: string;
  label: string;
  scope: string;
  target: string;
  visibleCounterpart: string;
}

export interface CommandPaletteCommand {
  authorized?: boolean;
  children?: readonly CommandPaletteCommand[];
  id: string;
  keywords?: readonly string[];
  kind?: "common" | "create" | "navigation" | "open-record" | "switch-project";
  label: string;
  reversible?: boolean;
  run: CommandPaletteAction;
  scope: string;
  selectionCount: number;
  shortcut: string;
  target: string;
  visibleCounterpart: string;
}

export interface CommandPaletteMutationContract {
  execute: (request: {
    commandId: string;
    run: CommandPaletteAction;
  }) => void | Promise<void>;
}

export interface CommandPaletteCommandSource {
  authorizedProjects?: readonly CommandPaletteProject[];
  authorizedRecords?: Iterable<CommandPaletteRecord>;
  commands?: readonly CommandPaletteCommand[];
  createOptions?: readonly CommandPaletteCreateOption[];
  onCreate?: (option: CommandPaletteCreateOption) => void | Promise<void>;
  onOpenRecord?: (record: CommandPaletteRecord) => void | Promise<void>;
  onSwitchProject?: (project: CommandPaletteProject) => void | Promise<void>;
}

export interface BuildCommandPaletteCommandsOptions {
  includeAuthorizedRecords?: boolean;
}

function commandSearchValues(command: CommandPaletteCommand) {
  return [
    command.id,
    command.label,
    command.scope,
    command.target,
    command.visibleCounterpart,
    ...(command.keywords ?? []),
  ];
}

function commandMatchesQuery(
  command: CommandPaletteCommand,
  queryTokens: readonly string[],
) {
  const searchableText = commandSearchValues(command).join(" ").toLowerCase();
  return queryTokens.every((token) => searchableText.includes(token));
}

export function filterCommandPaletteCommands(
  commands: readonly CommandPaletteCommand[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...commands];
  }

  const queryTokens = normalizedQuery.split(COMMAND_QUERY_TOKEN_PATTERN);

  return commands.filter((command) =>
    commandMatchesQuery(command, queryTokens),
  );
}

export function filterAndLimitCommandPaletteCommands(
  commands: readonly CommandPaletteCommand[],
  query: string,
  limit = COMMAND_PALETTE_MAX_VISIBLE_ITEMS,
) {
  if (limit <= 0) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return commands.slice(0, limit);
  }

  const queryTokens = normalizedQuery.split(COMMAND_QUERY_TOKEN_PATTERN);
  const matchingCommands: CommandPaletteCommand[] = [];
  for (const command of commands) {
    if (!commandMatchesQuery(command, queryTokens)) {
      continue;
    }

    matchingCommands.push(command);
    if (matchingCommands.length === limit) {
      break;
    }
  }

  return matchingCommands;
}

export class CommandPaletteUnavailableError extends Error {
  constructor(commandLabel: string) {
    super(`${commandLabel} is unavailable in this context.`);
    this.name = "CommandPaletteUnavailableError";
  }
}

function unavailableAction(commandLabel: string): CommandPaletteAction {
  return () => {
    throw new CommandPaletteUnavailableError(commandLabel);
  };
}

function authorizedEntries<T extends { authorized?: boolean }>(
  entries: Iterable<T> | undefined,
) {
  const authorized: T[] = [];
  for (const entry of entries ?? []) {
    if (entry.authorized !== false) {
      authorized.push(entry);
    }
  }
  return authorized;
}

function authorizedCommands(
  commands: readonly CommandPaletteCommand[] | undefined,
): CommandPaletteCommand[] {
  return authorizedEntries(commands).map((command) => {
    if (!command.children) {
      return command;
    }

    const children: CommandPaletteCommand[] = authorizedCommands(
      command.children,
    );

    if (children.length === 0) {
      return {
        ...command,
        children: undefined,
        run: unavailableAction(command.label),
      };
    }

    return {
      ...command,
      children,
    };
  });
}

function projectCommand(
  project: CommandPaletteProject,
  onSwitchProject: CommandPaletteCommandSource["onSwitchProject"],
): CommandPaletteCommand {
  return {
    id: `switch-project-${project.id}`,
    keywords: ["switch", "project", project.name],
    kind: "switch-project",
    label: project.name,
    run: onSwitchProject
      ? () => onSwitchProject(project)
      : unavailableAction("Switch Project"),
    scope: "Workspace",
    selectionCount: 1,
    shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
    target: project.name,
    visibleCounterpart: project.visibleCounterpart,
  };
}

function createOptionCommand(
  option: CommandPaletteCreateOption,
  onCreate: CommandPaletteCommandSource["onCreate"],
): CommandPaletteCommand {
  return {
    id: `create-${option.id}`,
    keywords: ["create", option.label, option.scope, option.target],
    kind: "create",
    label: `Create ${option.label}`,
    run: onCreate ? () => onCreate(option) : unavailableAction("Create"),
    scope: option.scope,
    selectionCount: 0,
    shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
    target: option.target,
    visibleCounterpart: option.visibleCounterpart,
  };
}

function recordCommand(
  record: CommandPaletteRecord,
  onOpenRecord: CommandPaletteCommandSource["onOpenRecord"],
): CommandPaletteCommand {
  return {
    id: `open-record-${record.id}`,
    keywords: ["open", record.title, record.type, record.scope],
    kind: "open-record",
    label: record.title,
    run: onOpenRecord
      ? () => onOpenRecord(record)
      : unavailableAction(record.title),
    scope: record.scope,
    selectionCount: 1,
    shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
    target: record.title,
    visibleCounterpart: record.visibleCounterpart,
  };
}

function recordMatchesQuery(
  record: CommandPaletteRecord,
  queryTokens: readonly string[],
) {
  const searchableText = [
    record.id,
    record.title,
    record.type,
    record.scope,
    record.visibleCounterpart,
    "open",
  ]
    .join(" ")
    .toLowerCase();
  return queryTokens.every((token) => searchableText.includes(token));
}

export function buildCommandPaletteRecordCommands(
  records: Iterable<CommandPaletteRecord> | undefined,
  onOpenRecord: CommandPaletteCommandSource["onOpenRecord"],
  query: string,
  limit = COMMAND_PALETTE_MAX_VISIBLE_ITEMS,
) {
  if (limit <= 0) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const queryTokens = normalizedQuery
    ? normalizedQuery.split(COMMAND_QUERY_TOKEN_PATTERN)
    : [];
  const recordCommands: CommandPaletteCommand[] = [];

  for (const record of records ?? []) {
    if (record.authorized === false) {
      continue;
    }

    if (queryTokens.length > 0 && !recordMatchesQuery(record, queryTokens)) {
      continue;
    }

    recordCommands.push(recordCommand(record, onOpenRecord));
    if (recordCommands.length === limit) {
      break;
    }
  }

  return recordCommands;
}

function createSwitchProjectCommand(
  projects: readonly CommandPaletteProject[],
  onSwitchProject: CommandPaletteCommandSource["onSwitchProject"],
): CommandPaletteCommand {
  const children = projects.map((project) =>
    projectCommand(project, onSwitchProject),
  );
  const [firstProjectCommand] = children;
  const [firstProject] = projects;
  const run =
    firstProjectCommand && projects.length === 1
      ? firstProjectCommand.run
      : unavailableAction("Switch Project");

  return {
    children: children.length > 0 ? children : undefined,
    id: "switch-project",
    keywords: ["switch", "project", ...projects.map((project) => project.name)],
    kind: "switch-project",
    label: "Switch Project",
    run,
    scope: "Workspace",
    selectionCount: projects.length,
    shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
    target:
      firstProject && projects.length === 1
        ? firstProject.name
        : "Authorized Projects",
    visibleCounterpart: firstProject?.visibleCounterpart ?? "Switch Project",
  };
}

function createCreateCommand(
  options: readonly CommandPaletteCreateOption[],
  onCreate: CommandPaletteCommandSource["onCreate"],
): CommandPaletteCommand {
  const children = options.map((option) =>
    createOptionCommand(option, onCreate),
  );
  const [firstOptionCommand] = children;
  const [firstOption] = options;
  const run =
    firstOptionCommand && options.length === 1
      ? firstOptionCommand.run
      : unavailableAction("Create");

  return {
    children: children.length > 0 ? children : undefined,
    id: "create",
    keywords: [
      "create",
      ...options.flatMap((option) => [
        option.label,
        option.scope,
        option.target,
      ]),
    ],
    kind: "create",
    label: "Create",
    run,
    scope: firstOption?.scope ?? "Authorized scope",
    selectionCount: 0,
    shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
    target:
      firstOption && options.length === 1
        ? firstOption.target
        : "Supported record types",
    visibleCounterpart: firstOption?.visibleCounterpart ?? "Create",
  };
}

export function buildCommandPaletteCommands(
  source: CommandPaletteCommandSource = {},
  options: BuildCommandPaletteCommandsOptions = {},
): CommandPaletteCommand[] {
  const projects = authorizedEntries(source.authorizedProjects);
  const records =
    options.includeAuthorizedRecords === false
      ? []
      : authorizedEntries(source.authorizedRecords);
  const createOptions = authorizedEntries(source.createOptions);

  return [
    createSwitchProjectCommand(projects, source.onSwitchProject),
    createCreateCommand(createOptions, source.onCreate),
    ...records.map((record) => recordCommand(record, source.onOpenRecord)),
    ...authorizedCommands(source.commands),
  ];
}

export function executeCommand(
  command: CommandPaletteCommand,
  mutationContract?: CommandPaletteMutationContract,
) {
  if (command.reversible) {
    if (!mutationContract) {
      throw new CommandPaletteUnavailableError(command.label);
    }

    return mutationContract.execute({
      commandId: command.id,
      run: command.run,
    });
  }

  return command.run();
}
