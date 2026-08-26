import { Button } from "@cantiara/ui/components/button";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@cantiara/ui/components/command";
import { Kbd } from "@cantiara/ui/components/kbd";
import { useCallback, useEffect, useRef, useState } from "react";

import { sessionUser } from "@/features/personal-shell/components/session-user";
import { authClient } from "@/lib/auth-client";

import {
	type CommandPalette,
	createCommandPalette,
	emptyFounderPaletteInput,
	type PaletteCommand,
	type PaletteSnapshot,
} from "../command-palette";
import {
	COMMAND_PALETTE_COPY,
	COMMAND_PALETTE_SHORTCUT_HINT,
} from "../command-palette-copy";

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

export function FounderCommandPalette() {
	const { data: session } = authClient.useSession();
	const user = sessionUser(session);
	const paletteRef = useRef<CommandPalette>(
		createCommandPalette(emptyFounderPaletteInput())
	);
	const [snapshot, setSnapshot] = useState<PaletteSnapshot>(() =>
		paletteRef.current.snapshot()
	);

	const publish = useCallback((next: PaletteSnapshot) => {
		setSnapshot(next);
	}, []);

	const onOpen = useCallback(() => {
		publish(paletteRef.current.open());
	}, [publish]);

	const onDismiss = useCallback(() => {
		publish(
			paletteRef.current.handleKeyDown({
				ctrlKey: false,
				key: "Escape",
				metaKey: false,
			}).snapshot
		);
	}, [publish]);

	const onCreate = useCallback(() => {
		paletteRef.current.open();
		publish(paletteRef.current.run("create:work").snapshot);
	}, [publish]);

	const onSwitchProject = useCallback(() => {
		paletteRef.current.open();
		publish(paletteRef.current.setQuery(COMMAND_PALETTE_COPY.switchProject));
	}, [publish]);

	const onQuery = useCallback(
		(query: string) => {
			publish(paletteRef.current.setQuery(query));
		},
		[publish]
	);

	const onRun = useCallback(
		(commandId: string) => {
			publish(paletteRef.current.run(commandId).snapshot);
		},
		[publish]
	);

	useEffect(() => {
		if (!user) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			const result = paletteRef.current.handleKeyDown({
				ctrlKey: event.ctrlKey,
				key: event.key,
				metaKey: event.metaKey,
				repeat: event.repeat,
			});
			if (result.consume) {
				event.preventDefault();
				publish(result.snapshot);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [publish, user]);

	if (!user) {
		return null;
	}

	return (
		<div className="flex items-center gap-2">
			<Button onClick={onOpen} type="button" variant="outline">
				{COMMAND_PALETTE_COPY.title}
				<Kbd className="ml-2">{COMMAND_PALETTE_SHORTCUT_HINT}</Kbd>
			</Button>
			<Button onClick={onCreate} type="button" variant="outline">
				{COMMAND_PALETTE_COPY.create}
			</Button>
			<Button onClick={onSwitchProject} type="button" variant="outline">
				{COMMAND_PALETTE_COPY.switchProject}
			</Button>
			{snapshot.visible ? (
				<div className="fixed inset-0 z-50">
					<button
						aria-label="Close"
						className="absolute inset-0 bg-black/10"
						onClick={onDismiss}
						type="button"
					/>
					<div
						aria-labelledby="command-palette-title"
						aria-modal="true"
						className="absolute top-[20%] left-1/2 w-full max-w-lg -translate-x-1/2 border bg-popover text-popover-foreground shadow-lg"
						role="dialog"
					>
						<h2 className="sr-only" id="command-palette-title">
							{snapshot.title}
						</h2>
						<Command shouldFilter={false}>
							<CommandInput
								autoFocus
								onValueChange={onQuery}
								placeholder=""
								value={snapshot.query}
							/>
							<CommandList>
								{snapshot.commands.length === 0 ? (
									<p className="py-6 text-center text-xs">
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
							<p className="border-t px-3 py-2 text-destructive text-xs">
								{snapshot.failure}
							</p>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	);
}
