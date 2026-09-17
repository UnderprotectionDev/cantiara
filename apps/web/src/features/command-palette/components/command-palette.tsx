import { Button } from "@cantiara/ui/components/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@cantiara/ui/components/command";
import { Kbd } from "@cantiara/ui/components/kbd";
import { useNavigate } from "@tanstack/react-router";
import { createStore, useStore } from "@tanstack/react-store";
import {
  AlertCircle,
  ArrowLeftRight,
  ChevronLeft,
  Command as CommandIcon,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  Monitor,
  Plus,
  SearchX,
  Settings2,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  buildCommandPaletteCommands,
  buildCommandPaletteRecordCommands,
  COMMAND_PALETTE_COMMAND_SHORTCUT,
  COMMAND_PALETTE_MAX_VISIBLE_ITEMS,
  type CommandPaletteCommand,
  type CommandPaletteCommandSource,
  type CommandPaletteMutationContract,
  type CommandPaletteRecord,
  executeCommand,
  filterAndLimitCommandPaletteCommands,
} from "./command-palette-commands";

const MAC_PLATFORM_PATTERN = /Mac|iPhone|iPad/;

interface CommandPaletteProviderState {
  initialQuery: string;
  open: boolean;
}

interface CommandPaletteContextValue {
  openPalette: (trigger?: HTMLElement | null) => void;
  openPaletteForCommand: (
    commandId: string,
    trigger?: HTMLElement | null,
  ) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

export interface CommandPaletteProps {
  authorizedRecords?: Iterable<CommandPaletteRecord>;
  commands: readonly CommandPaletteCommand[];
  initialQuery?: string;
  mutationContract?: CommandPaletteMutationContract;
  onOpenChange: (open: boolean) => void;
  onOpenRecord?: CommandPaletteCommandSource["onOpenRecord"];
  open: boolean;
}

function commandFailureReason(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "The command could not be completed.";
}

export default function CommandPalette({
  authorizedRecords,
  commands,
  initialQuery = "",
  mutationContract,
  onOpenChange,
  onOpenRecord,
  open,
}: CommandPaletteProps) {
  const [commandStack, setCommandStack] = useState<
    readonly (readonly CommandPaletteCommand[])[]
  >([]);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [query, setQuery] = useState(initialQuery);

  const activeCommands = commandStack.at(-1) ?? commands;
  const commandGroups = useMemo(() => {
    const common: CommandPaletteCommand[] = [];
    const records: CommandPaletteCommand[] = [];

    for (const command of activeCommands) {
      if (command.kind === "open-record") {
        records.push(command);
      } else {
        common.push(command);
      }
    }

    return { common, records };
  }, [activeCommands]);
  const commonCommands = useMemo(
    () =>
      filterAndLimitCommandPaletteCommands(
        commandGroups.common,
        query,
        COMMAND_PALETTE_MAX_VISIBLE_ITEMS,
      ),
    [commandGroups.common, query],
  );
  const sourceRecordCommands = useMemo(
    () =>
      open && commandStack.length === 0
        ? buildCommandPaletteRecordCommands(
            authorizedRecords,
            onOpenRecord,
            query,
            COMMAND_PALETTE_MAX_VISIBLE_ITEMS,
          )
        : [],
    [authorizedRecords, commandStack.length, onOpenRecord, open, query],
  );
  const recordCommandsFromCommandList = useMemo(
    () =>
      filterAndLimitCommandPaletteCommands(
        commandGroups.records,
        query,
        COMMAND_PALETTE_MAX_VISIBLE_ITEMS - sourceRecordCommands.length,
      ),
    [commandGroups.records, query, sourceRecordCommands.length],
  );
  const recordCommands = [
    ...sourceRecordCommands,
    ...recordCommandsFromCommandList,
  ];

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setFailureReason(null);
      setCommandStack([]);
      return;
    }

    setQuery("");
    setFailureReason(null);
    setCommandStack([]);
  }, [initialQuery, open]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setQuery("");
        setFailureReason(null);
        setCommandStack([]);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleSelect = useCallback(
    async (command: CommandPaletteCommand) => {
      if (isRunning) {
        return;
      }

      setFailureReason(null);
      if (command.children && command.children.length > 0) {
        setCommandStack((stack) => [...stack, command.children ?? []]);
        setQuery("");
        return;
      }

      setIsRunning(true);
      try {
        await executeCommand(command, mutationContract);
        handleOpenChange(false);
      } catch (error) {
        setFailureReason(commandFailureReason(error));
      } finally {
        setIsRunning(false);
      }
    },
    [handleOpenChange, isRunning, mutationContract],
  );

  const handleBack = useCallback(() => {
    setCommandStack((stack) => stack.slice(0, -1));
    setQuery("");
    setFailureReason(null);
  }, []);

  return (
    <CommandDialog
      className="top-1/2 max-h-[calc(100svh-2rem)] w-[calc(100%-1rem)] max-w-2xl -translate-y-1/2 border border-border/80 p-0 shadow-none sm:max-w-2xl"
      description="Run an authorized product command."
      onOpenChange={handleOpenChange}
      open={open}
      title="Command Palette"
    >
      <Command
        className="min-h-0 text-sm"
        label="Filter Command Palette commands"
      >
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted/60 text-foreground">
                <CommandIcon aria-hidden="true" className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">Command Palette</p>
                <p className="truncate text-muted-foreground text-xs">
                  Run an authorized product command.
                </p>
              </div>
            </div>
            <Kbd className="shrink-0 border border-border bg-muted px-1.5 text-[10px] tracking-normal">
              Esc
            </Kbd>
          </div>
          {commandStack.length > 0 ? (
            <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-2">
              <Button
                aria-label="Back to commands"
                className="border border-transparent hover:border-border"
                onClick={handleBack}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="font-medium text-sm">Choose a target</span>
            </div>
          ) : null}
          <CommandInput
            aria-label="Filter Command Palette commands"
            className="text-sm placeholder:text-muted-foreground"
            inputGroupClassName="h-10 border-border/70 bg-background/50 focus-within:border-ring/70 focus-within:ring-1 focus-within:ring-ring/50"
            onValueChange={setQuery}
            placeholder="Type a command or authorized record…"
            value={query}
            wrapperClassName="border-b border-border/80 px-4 py-2"
          />
          {failureReason ? (
            <div
              aria-live="assertive"
              className="flex gap-2 border-destructive border-b bg-destructive/10 px-4 py-3 text-destructive text-xs"
              role="alert"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">Can’t run this here</p>
                <p className="break-words">{failureReason}</p>
              </div>
            </div>
          ) : null}
          <CommandList
            className="max-h-[min(32rem,calc(100svh-8rem))] p-2"
            label="Command Palette commands"
          >
            <CommandEmpty className="py-10">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <SearchX aria-hidden="true" className="size-4" />
                <span className="text-foreground">No matching command</span>
              </div>
            </CommandEmpty>
            {commonCommands.length > 0 ? (
              <CommandGroup className="mb-2" heading="Commands">
                {commonCommands.map((command) => (
                  <PaletteCommandItem
                    command={command}
                    disabled={isRunning}
                    key={command.id}
                    onSelect={handleSelect}
                    running={isRunning}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {recordCommands.length > 0 ? (
              <CommandGroup
                className={
                  commonCommands.length > 0
                    ? "mt-3 border-border border-t pt-2"
                    : undefined
                }
                heading="Authorized records"
              >
                {recordCommands.map((command) => (
                  <PaletteCommandItem
                    command={command}
                    disabled={isRunning}
                    key={command.id}
                    onSelect={handleSelect}
                    running={isRunning}
                  />
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </div>
      </Command>
    </CommandDialog>
  );
}

function PaletteCommandItem({
  command,
  disabled,
  onSelect,
  running,
}: {
  command: CommandPaletteCommand;
  disabled: boolean;
  onSelect: (command: CommandPaletteCommand) => void;
  running: boolean;
}) {
  const handleSelect = useCallback(
    () => onSelect(command),
    [command, onSelect],
  );

  return (
    <CommandItem
      className="min-h-16 items-start gap-3 border border-transparent px-3 py-2.5 transition-colors data-selected:border-border/80 data-selected:bg-accent/60 sm:min-h-[4.5rem]"
      data-command-id={command.id}
      data-scope={command.scope}
      data-selection-count={command.selectionCount}
      data-target={command.target}
      disabled={disabled}
      keywords={[
        command.label,
        command.scope,
        command.target,
        command.visibleCounterpart,
        ...(command.keywords ?? []),
      ]}
      onSelect={handleSelect}
      value={command.id}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-border bg-background/50 text-muted-foreground transition-colors group-data-selected/command-item:border-foreground/20 group-data-selected/command-item:text-foreground">
        <PaletteCommandIcon command={command} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate font-medium text-sm">{command.label}</div>
        <div className="flex min-w-0 flex-wrap gap-1.5 text-[10px] leading-4">
          <PaletteMetadata label="Scope" value={command.scope} />
          <PaletteMetadata label="Target" value={command.target} />
          <PaletteMetadata label="Selection" value={command.selectionCount} />
        </div>
        <div className="min-w-0 truncate text-[11px] text-muted-foreground">
          Menu: {command.visibleCounterpart}
        </div>
      </div>
      <CommandShortcut className="mt-0.5 min-w-10 border border-border bg-background px-1.5 py-0.5 text-center text-[10px] tracking-normal group-data-selected/command-item:border-foreground/20">
        {running ? (
          <LoaderCircle
            aria-hidden="true"
            className="mr-1 inline size-3 animate-spin motion-reduce:animate-none"
          />
        ) : null}
        {command.shortcut}
      </CommandShortcut>
    </CommandItem>
  );
}

function PaletteCommandIcon({ command }: { command: CommandPaletteCommand }) {
  if (command.kind === "switch-project") {
    return <ArrowLeftRight aria-hidden="true" className="size-4" />;
  }
  if (command.kind === "create") {
    return <Plus aria-hidden="true" className="size-4" />;
  }
  if (command.kind === "open-record") {
    return <FileText aria-hidden="true" className="size-4" />;
  }
  if (command.kind === "navigation") {
    switch (command.target) {
      case "Dashboard":
        return <LayoutDashboard aria-hidden="true" className="size-4" />;
      case "Sessions":
        return <Monitor aria-hidden="true" className="size-4" />;
      case "Preferences":
        return <Settings2 aria-hidden="true" className="size-4" />;
      default:
        return <CommandIcon aria-hidden="true" className="size-4" />;
    }
  }
  return <CommandIcon aria-hidden="true" className="size-4" />;
}

function PaletteMetadata({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full truncate border border-border/70 bg-background/30 px-1.5 py-0.5 text-muted-foreground">
      {label}: {value}
    </span>
  );
}

export function commandPaletteShortcutLabel() {
  if (
    typeof navigator !== "undefined" &&
    MAC_PLATFORM_PATTERN.test(navigator.platform)
  ) {
    return "⌘K";
  }
  return "Ctrl+K";
}

export function CommandPaletteTrigger() {
  const palette = useContext(CommandPaletteContext);
  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      palette?.openPalette(event.currentTarget),
    [palette],
  );
  if (!palette) {
    return null;
  }

  const shortcut = commandPaletteShortcutLabel();
  return (
    <Button
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      aria-label={`Open Command Palette (${shortcut})`}
      className="gap-2 border-border/80 bg-background/60"
      onClick={handleClick}
      type="button"
      variant="outline"
    >
      <CommandIcon aria-hidden="true" />
      <span>Command Palette</span>
      <Kbd>{shortcut}</Kbd>
    </Button>
  );
}

export function CommandPaletteQuickActions() {
  const palette = useContext(CommandPaletteContext);
  const handleSwitchProjectClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      palette?.openPaletteForCommand("switch-project", event.currentTarget),
    [palette],
  );
  const handleCreateClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      palette?.openPaletteForCommand("create", event.currentTarget),
    [palette],
  );
  if (!palette) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-border border-l pl-2">
      <Button
        className="border border-transparent hover:border-border"
        onClick={handleSwitchProjectClick}
        type="button"
        variant="ghost"
      >
        Switch Project
      </Button>
      <Button
        className="border border-transparent hover:border-border"
        onClick={handleCreateClick}
        type="button"
        variant="ghost"
      >
        Create
      </Button>
    </div>
  );
}

interface CommandPaletteProviderProps {
  children: ReactNode;
  mutationContract?: CommandPaletteMutationContract;
  source: CommandPaletteCommandSource;
}

export function CommandPaletteProvider({
  children,
  mutationContract,
  source,
}: CommandPaletteProviderProps) {
  const {
    authorizedProjects,
    authorizedRecords,
    commands,
    createOptions,
    onCreate,
    onOpenRecord,
    onSwitchProject,
  } = source;
  const navigate = useNavigate();
  const [paletteStore] = useState(() =>
    createStore<CommandPaletteProviderState>({
      initialQuery: "",
      open: false,
    }),
  );
  const { initialQuery, open } = useStore(paletteStore);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef<boolean | null>(null);

  const navigationCommands = useMemo<CommandPaletteCommand[]>(() => {
    const navigationCommand = ({
      id,
      keywords,
      label,
      scope,
      target,
      to,
    }: {
      id: string;
      keywords: string[];
      label: string;
      scope: string;
      target: string;
      to: "/dashboard" | "/account" | "/account/preferences";
    }): CommandPaletteCommand => ({
      id,
      keywords,
      kind: "navigation",
      label,
      run: () => navigate({ to }),
      scope,
      selectionCount: 1,
      shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
      target,
      visibleCounterpart: target,
    });

    return [
      navigationCommand({
        id: "open-dashboard",
        keywords: ["open", "dashboard"],
        label: "Open Dashboard",
        scope: "Workspace",
        target: "Dashboard",
        to: "/dashboard",
      }),
      navigationCommand({
        id: "open-sessions",
        keywords: ["open", "sessions", "account"],
        label: "Open Sessions",
        scope: "Account",
        target: "Sessions",
        to: "/account",
      }),
      navigationCommand({
        id: "open-preferences",
        keywords: ["open", "preferences", "account"],
        label: "Open Preferences",
        scope: "Account",
        target: "Preferences",
        to: "/account/preferences",
      }),
    ];
  }, [navigate]);

  const paletteCommands = useMemo(
    () =>
      buildCommandPaletteCommands({
        authorizedProjects,
        commands: [...navigationCommands, ...(commands ?? [])],
        createOptions,
        onCreate,
        onOpenRecord,
        onSwitchProject,
      }),
    [
      authorizedProjects,
      commands,
      createOptions,
      navigationCommands,
      onCreate,
      onOpenRecord,
      onSwitchProject,
    ],
  );

  const rememberFocus = useCallback((trigger?: HTMLElement | null) => {
    if (trigger) {
      returnFocusRef.current = trigger;
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
  }, []);

  const openPalette = useCallback(
    (trigger?: HTMLElement | null) => {
      rememberFocus(trigger);
      paletteStore.setState(() => ({ initialQuery: "", open: true }));
    },
    [paletteStore, rememberFocus],
  );

  const openPaletteForCommand = useCallback(
    (commandId: string, trigger?: HTMLElement | null) => {
      rememberFocus(trigger);
      const command = paletteCommands.find(
        (candidate) => candidate.id === commandId,
      );
      paletteStore.setState(() => ({
        initialQuery: command?.label ?? "",
        open: true,
      }));
    },
    [paletteCommands, paletteStore, rememberFocus],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      paletteStore.setState((state) => ({
        initialQuery: nextOpen ? state.initialQuery : "",
        open: nextOpen,
      }));
    },
    [paletteStore],
  );

  useEffect(() => {
    if (wasOpenRef.current === true && !open) {
      returnFocusRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }

      event.preventDefault();
      openPalette();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openPalette]);

  const contextValue = useMemo(
    () => ({ openPalette, openPaletteForCommand }),
    [openPalette, openPaletteForCommand],
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPalette
        authorizedRecords={authorizedRecords}
        commands={paletteCommands}
        initialQuery={initialQuery}
        mutationContract={mutationContract}
        onOpenChange={handleOpenChange}
        onOpenRecord={onOpenRecord}
        open={open}
      />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}
