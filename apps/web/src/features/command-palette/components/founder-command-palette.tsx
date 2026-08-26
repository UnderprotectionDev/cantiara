import { Button } from "@cantiara/ui/components/button";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@cantiara/ui/components/command";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Kbd } from "@cantiara/ui/components/kbd";
import { CommandIcon } from "lucide-react";
import {
	createContext,
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { MUTATION_COPY } from "@/lib/mutation";

import {
	type CommandPalette,
	createCommandPalette,
	emptyFounderPaletteInput,
	isPaletteDismissShortcut,
	isPaletteOpenShortcut,
	type PaletteCommand,
	type PaletteRunResult,
	type PaletteSnapshot,
	type PaletteSurface,
	shouldRenderFounderPalette,
} from "../command-palette";
import {
	COMMAND_PALETTE_COPY,
	COMMAND_PALETTE_SHORTCUT_HINT,
} from "../command-palette-copy";

interface CommandPaletteActions {
	canUndo: boolean;
	openCreate: () => void;
	openPalette: () => void;
	openRecord: () => void;
	openSwitchProject: () => void;
	undoLabel: typeof MUTATION_COPY.undo | null;
	undoLast: () => void;
}

const CommandPaletteActionsContext =
	createContext<CommandPaletteActions | null>(null);

const PaletteSurfaceContext = createContext<PaletteSurface>("founder");

export function PaletteSurfaceProvider({
	children,
	surface,
}: {
	children: ReactNode;
	surface: PaletteSurface;
}) {
	return (
		<PaletteSurfaceContext.Provider value={surface}>
			{children}
		</PaletteSurfaceContext.Provider>
	);
}

export function usePaletteSurface(): PaletteSurface {
	return useContext(PaletteSurfaceContext);
}

export function useCommandPaletteActions(): CommandPaletteActions | null {
	return useContext(CommandPaletteActionsContext);
}

function hasProductUser(session: unknown): boolean {
	if (!session || typeof session !== "object" || !("user" in session)) {
		return false;
	}
	const { user } = session as { user?: unknown };
	return Boolean(user && typeof user === "object");
}

function previewLine(command: PaletteCommand): string {
	return `${command.preview.scope} · ${command.preview.target} · ${command.preview.selectionCount}`;
}

function PaletteCommandItem({
	command,
	onRun,
}: {
	command: PaletteCommand;
	onRun: (commandId: string) => void;
}) {
	const onSelect = useCallback(() => {
		onRun(command.id);
	}, [command.id, onRun]);

	return (
		<CommandItem onSelect={onSelect} value={command.id}>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span>{command.label}</span>
				<span className="text-muted-foreground">{previewLine(command)}</span>
			</div>
			{command.shortcutHint ? (
				<CommandShortcut>{command.shortcutHint}</CommandShortcut>
			) : null}
		</CommandItem>
	);
}

export function CommandPaletteTrigger() {
	const actions = useCommandPaletteActions();
	if (actions === null) {
		return null;
	}

	return (
		<Button
			aria-keyshortcuts={COMMAND_PALETTE_SHORTCUT_HINT}
			aria-label={COMMAND_PALETTE_COPY.title}
			className="h-8 gap-1.5 px-2 font-normal text-muted-foreground"
			onClick={actions.openPalette}
			size="sm"
			title={`${COMMAND_PALETTE_COPY.title} (${COMMAND_PALETTE_SHORTCUT_HINT})`}
			type="button"
			variant="ghost"
		>
			<CommandIcon aria-hidden="true" className="size-4" />
			<Kbd className="hidden sm:inline-flex">
				{COMMAND_PALETTE_SHORTCUT_HINT}
			</Kbd>
		</Button>
	);
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
	const surface = usePaletteSurface();
	const { data: session } = authClient.useSession();
	const signedIn = hasProductUser(session);
	const mountPalette = shouldRenderFounderPalette(surface, signedIn);
	const paletteRef = useRef<CommandPalette>(
		createCommandPalette(emptyFounderPaletteInput())
	);
	const [snapshot, setSnapshot] = useState<PaletteSnapshot>(() =>
		paletteRef.current.snapshot()
	);

	const showSnapshot = useCallback((next: PaletteSnapshot) => {
		setSnapshot(next);
	}, []);

	const openPalette = useCallback(() => {
		showSnapshot(paletteRef.current.open());
	}, [showSnapshot]);

	const onDismiss = useCallback(() => {
		showSnapshot(
			paletteRef.current.handleKeyDown({
				ctrlKey: false,
				key: "Escape",
				metaKey: false,
			}).snapshot
		);
	}, [showSnapshot]);

	const openCreate = useCallback(() => {
		paletteRef.current.open();
		showSnapshot(paletteRef.current.setQuery(COMMAND_PALETTE_COPY.create));
	}, [showSnapshot]);

	const openSwitchProject = useCallback(() => {
		paletteRef.current.open();
		showSnapshot(
			paletteRef.current.setQuery(COMMAND_PALETTE_COPY.switchProject)
		);
	}, [showSnapshot]);

	const openRecord = useCallback(() => {
		showSnapshot(paletteRef.current.open());
	}, [showSnapshot]);

	const onQuery = useCallback(
		(query: string) => {
			showSnapshot(paletteRef.current.setQuery(query));
		},
		[showSnapshot]
	);

	const onFilterKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLInputElement>) => {
			if (event.key !== "Enter" || snapshot.commands.length > 0) {
				return;
			}
			const result = paletteRef.current.handleKeyDown({
				ctrlKey: event.ctrlKey,
				key: event.key,
				metaKey: event.metaKey,
				repeat: event.repeat,
			});
			if (result.consume) {
				event.preventDefault();
				showSnapshot(result.snapshot);
			}
		},
		[showSnapshot, snapshot.commands.length]
	);

	const undoLast = useCallback(() => {
		showSnapshot(paletteRef.current.undoLast().snapshot);
	}, [showSnapshot]);

	const offerUndo = useCallback(
		(result: PaletteRunResult) => {
			if (!(result.wrote && result.undoLabel)) {
				return;
			}
			toast(COMMAND_PALETTE_COPY.create, {
				action: {
					label: result.undoLabel,
					onClick: undoLast,
				},
			});
		},
		[undoLast]
	);

	const onRun = useCallback(
		(commandId: string) => {
			const result = paletteRef.current.run(commandId);
			showSnapshot(result.snapshot);
			offerUndo(result);
		},
		[offerUndo, showSnapshot]
	);

	const onOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (nextOpen) {
				openPalette();
				return;
			}
			onDismiss();
		},
		[onDismiss, openPalette]
	);

	useEffect(() => {
		if (!mountPalette) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			const payload = {
				ctrlKey: event.ctrlKey,
				key: event.key,
				metaKey: event.metaKey,
				repeat: event.repeat,
			};
			const intercept =
				isPaletteOpenShortcut(payload) ||
				(snapshot.visible && isPaletteDismissShortcut(payload));
			if (!intercept) {
				return;
			}
			const result = paletteRef.current.handleKeyDown(payload);
			if (result.consume) {
				event.preventDefault();
				showSnapshot(result.snapshot);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [mountPalette, showSnapshot, snapshot.visible]);

	const actions = useMemo<CommandPaletteActions | null>(() => {
		if (!mountPalette) {
			return null;
		}
		return {
			canUndo: snapshot.canUndo,
			openCreate,
			openPalette,
			openRecord,
			openSwitchProject,
			undoLabel: snapshot.undoLabel,
			undoLast,
		};
	}, [
		openCreate,
		openPalette,
		openRecord,
		openSwitchProject,
		mountPalette,
		snapshot.canUndo,
		snapshot.undoLabel,
		undoLast,
	]);

	return (
		<CommandPaletteActionsContext.Provider value={actions}>
			{children}
			{mountPalette ? (
				<Dialog onOpenChange={onOpenChange} open={snapshot.visible}>
					<DialogContent
						className="data-closed:zoom-out-100 data-open:zoom-in-100 top-[20%] translate-y-0 overflow-hidden p-0 duration-0 sm:max-w-lg"
						showCloseButton={false}
					>
						<DialogHeader className="border-b px-3 py-2">
							<DialogTitle>{snapshot.title}</DialogTitle>
						</DialogHeader>
						<Command shouldFilter={false}>
							<CommandInput
								autoFocus
								onKeyDown={onFilterKeyDown}
								onValueChange={onQuery}
								placeholder=""
								value={snapshot.query}
							/>
							<CommandList>
								{snapshot.commands.length === 0 ? (
									<p className="py-6 text-center text-xs" role="status">
										{snapshot.emptyReason}
									</p>
								) : (
									<CommandGroup>
										{snapshot.commands.map((command) => (
											<PaletteCommandItem
												command={command}
												key={command.id}
												onRun={onRun}
											/>
										))}
									</CommandGroup>
								)}
							</CommandList>
						</Command>
						{snapshot.failure ? (
							<p
								aria-live="polite"
								className="border-t px-3 py-2 text-destructive text-xs"
								role="status"
							>
								{snapshot.failure}
							</p>
						) : null}
						{snapshot.canUndo ? (
							<div className="flex justify-end border-t px-3 py-2">
								<Button
									onClick={undoLast}
									size="sm"
									type="button"
									variant="ghost"
								>
									{snapshot.undoLabel ?? MUTATION_COPY.undo}
								</Button>
							</div>
						) : null}
					</DialogContent>
				</Dialog>
			) : null}
		</CommandPaletteActionsContext.Provider>
	);
}
