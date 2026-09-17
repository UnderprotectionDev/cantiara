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
import { ChevronLeft, Command as CommandIcon } from "lucide-react";
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
  COMMAND_PALETTE_COMMAND_SHORTCUT,
  type CommandPaletteCommand,
  type CommandPaletteCommandSource,
  type CommandPaletteMutationContract,
  executeCommand,
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
  commands: readonly CommandPaletteCommand[];
  initialQuery?: string;
  mutationContract?: CommandPaletteMutationContract;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function commandFailureReason(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "The command could not be completed.";
}

export default function CommandPalette({
  commands,
  initialQuery = "",
  mutationContract,
  onOpenChange,
  open,
}: CommandPaletteProps) {
  const [commandStack, setCommandStack] = useState<
    readonly (readonly CommandPaletteCommand[])[]
  >([]);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [query, setQuery] = useState(initialQuery);

  const activeCommands = commandStack.at(-1) ?? commands;
  const commonCommands = activeCommands.filter(
    (command) => command.kind !== "open-record",
  );
  const recordCommands = activeCommands.filter(
    (command) => command.kind === "open-record",
  );

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
      description="Run an authorized product command."
      onOpenChange={handleOpenChange}
      open={open}
      title="Command Palette"
    >
      <Command label="Filter Command Palette commands">
        <div className="relative">
          {commandStack.length > 0 ? (
            <div className="flex items-center gap-1 border-b px-1 py-1">
              <Button
                aria-label="Back to commands"
                onClick={handleBack}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="text-muted-foreground text-xs">
                Choose a target
              </span>
            </div>
          ) : null}
          <CommandInput
            aria-label="Filter Command Palette commands"
            onValueChange={setQuery}
            placeholder="Type a command or authorized record…"
            value={query}
          />
          {failureReason ? (
            <div
              aria-live="assertive"
              className="border-destructive border-b bg-destructive/10 px-3 py-2 text-destructive text-xs"
              role="alert"
            >
              <p className="font-medium">Can’t run this here</p>
              <p className="mt-0.5">{failureReason}</p>
            </div>
          ) : null}
          <CommandList aria-label="Command Palette commands">
            <CommandEmpty>No matching command</CommandEmpty>
            {commonCommands.length > 0 ? (
              <CommandGroup heading="Commands">
                {commonCommands.map((command) => (
                  <PaletteCommandItem
                    command={command}
                    disabled={isRunning}
                    key={command.id}
                    onSelect={handleSelect}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {recordCommands.length > 0 ? (
              <CommandGroup heading="Authorized records">
                {recordCommands.map((command) => (
                  <PaletteCommandItem
                    command={command}
                    disabled={isRunning}
                    key={command.id}
                    onSelect={handleSelect}
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
}: {
  command: CommandPaletteCommand;
  disabled: boolean;
  onSelect: (command: CommandPaletteCommand) => void;
}) {
  const handleSelect = useCallback(
    () => onSelect(command),
    [command, onSelect],
  );

  return (
    <CommandItem
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
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{command.label}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          Scope: {command.scope} · Target: {command.target} · Selection:{" "}
          {command.selectionCount}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          Menu: {command.visibleCounterpart}
        </div>
      </div>
      <CommandShortcut>{command.shortcut}</CommandShortcut>
    </CommandItem>
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
      aria-keyshortcuts="Control+K Meta+K"
      aria-label={`Open Command Palette (${shortcut})`}
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
    <div className="flex items-center gap-1">
      <Button onClick={handleSwitchProjectClick} type="button" variant="ghost">
        Switch Project
      </Button>
      <Button onClick={handleCreateClick} type="button" variant="ghost">
        Create
      </Button>
    </div>
  );
}

export function CommandPaletteProvider({
  authorizedProjects,
  authorizedRecords,
  children,
  commands,
  createOptions,
  mutationContract,
  onCreate,
  onOpenRecord,
  onSwitchProject,
}: CommandPaletteCommandSource & {
  children: ReactNode;
  mutationContract?: CommandPaletteMutationContract;
}) {
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
        authorizedRecords,
        commands: [...navigationCommands, ...(commands ?? [])],
        createOptions,
        onCreate,
        onOpenRecord,
        onSwitchProject,
      }),
    [
      authorizedProjects,
      authorizedRecords,
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
        commands={paletteCommands}
        initialQuery={initialQuery}
        mutationContract={mutationContract}
        onOpenChange={handleOpenChange}
        open={open}
      />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}
