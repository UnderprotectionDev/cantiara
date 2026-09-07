import { Button } from "@cantiara/ui/components/button";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { SCREENS_COPY } from "@/features/screens-and-wireframes/forms/screens-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import WireframeSurface from "./wireframe-surface";

type ExportFormat =
	| typeof SCREENS_COPY.html
	| typeof SCREENS_COPY.pdf
	| typeof SCREENS_COPY.png
	| typeof SCREENS_COPY.svg;

export default function ScreenDetail({
	onCleared,
	projectId,
	screenId,
}: {
	onCleared?: () => void;
	projectId: string;
	screenId: string;
}) {
	const screen = useQuery(
		orpc.screensAndWireframes.get.queryOptions({ input: { screenId } })
	);
	const listed = useQuery(
		orpc.screensAndWireframes.list.queryOptions({
			input: { projectId },
		})
	);
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.screensAndWireframes.list.queryKey({
				input: { projectId },
			}),
		});
		await screen.refetch();
	}, [projectId, screen]);

	const archive = useMutation(
		orpc.screensAndWireframes.archive.mutationOptions({
			onSuccess: () => {
				invalidate().catch(() => undefined);
			},
		})
	);
	const unarchive = useMutation(
		orpc.screensAndWireframes.unarchive.mutationOptions({
			onSuccess: () => {
				invalidate().catch(() => undefined);
			},
		})
	);
	const trash = useMutation(
		orpc.screensAndWireframes.trash.mutationOptions({
			onSuccess: () => {
				invalidate().catch(() => undefined);
			},
		})
	);
	const restore = useMutation(
		orpc.screensAndWireframes.restore.mutationOptions({
			onSuccess: () => {
				invalidate().catch(() => undefined);
			},
		})
	);
	const permanentlyDelete = useMutation(
		orpc.screensAndWireframes.permanentlyDelete.mutationOptions({
			onSuccess: () => {
				queryClient
					.invalidateQueries({
						queryKey: orpc.screensAndWireframes.list.queryKey({
							input: { projectId },
						}),
					})
					.catch(() => undefined);
				onCleared?.();
			},
		})
	);

	const run = useCallback(
		(kind: "archive" | "unarchive" | "trash" | "restore" | "delete") => {
			const revision = screen.data?.revision;
			if (!revision) {
				return;
			}
			const payload = {
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				screenId,
			};
			if (kind === "archive") {
				archive.mutate(payload);
				return;
			}
			if (kind === "unarchive") {
				unarchive.mutate(payload);
				return;
			}
			if (kind === "trash") {
				trash.mutate(payload);
				return;
			}
			if (kind === "restore") {
				restore.mutate(payload);
				return;
			}
			permanentlyDelete.mutate(payload);
		},
		[
			archive,
			permanentlyDelete,
			restore,
			screen.data?.revision,
			screenId,
			trash,
			unarchive,
		]
	);
	const onArchive = useCallback(() => {
		run("archive");
	}, [run]);
	const onUnarchive = useCallback(() => {
		run("unarchive");
	}, [run]);
	const onTrash = useCallback(() => {
		run("trash");
	}, [run]);
	const onRestore = useCallback(() => {
		run("restore");
	}, [run]);
	const onDelete = useCallback(() => {
		run("delete");
	}, [run]);
	const onWireframeChanged = useCallback(() => {
		invalidate().catch(() => undefined);
	}, [invalidate]);

	if (screen.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (screen.isError || !screen.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const record = screen.data;
	return (
		<div className="flex min-w-0 flex-col gap-4">
			<h2 className="font-semibold text-lg tracking-tight">{record.title}</h2>
			<p className="text-muted-foreground text-sm">{record.life}</p>
			{record.life === SCREENS_COPY.active ? (
				<ActiveWireframeWorkspace
					listed={listed.data ?? []}
					onArchive={onArchive}
					onChanged={onWireframeChanged}
					onTrash={onTrash}
					projectId={projectId}
					record={record}
					screenId={screenId}
				/>
			) : (
				<ScreenLifeActions
					life={record.life}
					onArchive={onArchive}
					onDelete={onDelete}
					onRestore={onRestore}
					onTrash={onTrash}
					onUnarchive={onUnarchive}
				/>
			)}
		</div>
	);
}

function ActiveWireframeWorkspace({
	listed,
	onArchive,
	onChanged,
	onTrash,
	projectId,
	record,
	screenId,
}: {
	listed: readonly {
		id: string;
		title: string;
		versions: readonly { versionNumber: number }[];
	}[];
	onArchive: () => void;
	onChanged: () => void;
	onTrash: () => void;
	projectId: string;
	record: {
		revision: number;
		title: string;
		versions: readonly { versionNumber: number }[];
	};
	screenId: string;
}) {
	const [presenting, setPresenting] = useState(false);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [unresolved, setUnresolved] = useState(false);
	const [currentScreenId, setCurrentScreenId] = useState(screenId);
	const pins = listed
		.filter((item) => item.versions.at(-1))
		.map((item) => ({
			screenId: item.id,
			versionNumber: item.versions.at(-1)?.versionNumber ?? 1,
		}));
	const presentation = useQuery({
		...orpc.screensAndWireframes.presentation.queryOptions({
			input: {
				pins: pins.length > 0 ? pins : [{ screenId, versionNumber: 1 }],
				startScreenId: screenId,
			},
		}),
		enabled: presenting && pins.length > 0,
	});
	const current =
		presentation.data?.status === "ok"
			? (presentation.data.screens.find(
					(item) => item.id === currentScreenId
				) ?? presentation.data.screens[0])
			: null;
	const includedIds = new Set(
		presentation.data?.status === "ok"
			? presentation.data.screens.map((item) => item.id)
			: []
	);
	const currentLinks = current
		? prototypeLinksOn(current.document, includedIds)
		: [];
	const onSelectNode = useCallback((nodeId: string) => {
		setSelectedNodeId(nodeId);
	}, []);
	const onTogglePresentation = useCallback(() => {
		setPresenting((currentMode) => !currentMode);
		setUnresolved(false);
		setCurrentScreenId(screenId);
	}, [screenId]);
	const onFollow = useCallback(
		(nodeId: string) => {
			const link = currentLinks.find((item) => item.nodeId === nodeId);
			if (link?.status !== "ok") {
				setUnresolved(true);
				return;
			}
			setUnresolved(false);
			setCurrentScreenId(link.targetScreenId);
		},
		[currentLinks]
	);
	return (
		<>
			<div className="flex flex-wrap gap-2">
				<Button onClick={onTogglePresentation} type="button" variant="outline">
					{presenting
						? SCREENS_COPY.exitPresentationMode
						: SCREENS_COPY.presentationMode}
				</Button>
				{presenting ? null : (
					<WireframeExportBar
						pins={pins}
						screenId={screenId}
						selectedNodeId={selectedNodeId}
					/>
				)}
			</div>
			{presenting && presentation.data?.status === "ok" ? (
				<PresentationStage
					nodes={current?.document.nodes ?? []}
					onExit={onTogglePresentation}
					onFollow={onFollow}
					title={
						listed.find((item) => item.id === currentScreenId)?.title ??
						record.title
					}
					unresolved={unresolved}
				/>
			) : null}
			{presenting ? null : (
				<>
					<WireframeSurface
						onChanged={onChanged}
						onSelectNode={onSelectNode}
						projectId={projectId}
						revision={record.revision}
						screenId={screenId}
						selectedNodeId={selectedNodeId}
						versionNumber={record.versions.at(-1)?.versionNumber ?? null}
					/>
					<ScreenLifeActions
						life={SCREENS_COPY.active}
						onArchive={onArchive}
						onTrash={onTrash}
					/>
				</>
			)}
		</>
	);
}
function prototypeLinksOn(
	document: {
		animations?: readonly {
			kind: string;
			nodeId?: string;
			targetScreenId?: string;
		}[];
		nodes: readonly { id: string; targetScreenId?: string }[];
	},
	includedIds: ReadonlySet<string>
): { nodeId: string; status: "ok" | "unresolved"; targetScreenId: string }[] {
	const byNode = new Map<string, string>();
	for (const node of document.nodes) {
		if (node.targetScreenId) {
			byNode.set(node.id, node.targetScreenId);
		}
	}
	for (const animation of document.animations ?? []) {
		if (
			animation.kind === "screenTransition" &&
			animation.nodeId &&
			animation.targetScreenId
		) {
			byNode.set(animation.nodeId, animation.targetScreenId);
		}
	}
	return [...byNode.entries()].map(([nodeId, targetScreenId]) => ({
		nodeId,
		status: includedIds.has(targetScreenId) ? "ok" : "unresolved",
		targetScreenId,
	}));
}

function PresentationStage({
	nodes,
	onExit,
	onFollow,
	title,
	unresolved,
}: {
	nodes: readonly { id: string; kind: string; label?: string }[];
	onExit: () => void;
	onFollow: (nodeId: string) => void;
	title: string;
	unresolved: boolean;
}) {
	return (
		<section className="fixed inset-0 z-50 flex flex-col gap-3 bg-background p-6">
			<div className="flex flex-wrap items-center gap-2">
				<Button onClick={onExit} type="button" variant="outline">
					{SCREENS_COPY.exitPresentationMode}
				</Button>
				<p className="font-medium text-sm">{title}</p>
			</div>
			{unresolved ? <p role="status">{SCREENS_COPY.unresolved}</p> : null}
			<ul className="flex flex-col gap-2">
				{nodes.map((node) => (
					<li key={node.id}>
						<PresentationNodeButton
							label={node.label ?? node.kind}
							nodeId={node.id}
							onFollow={onFollow}
						/>
					</li>
				))}
			</ul>
		</section>
	);
}

function WireframeExportBar({
	pins,
	screenId,
	selectedNodeId,
}: {
	pins: readonly { screenId: string; versionNumber: number }[];
	screenId: string;
	selectedNodeId: string | null;
}) {
	const onExport = useCallback(
		async (format: ExportFormat) => {
			if (pins.length === 0) {
				return;
			}
			const result = await queryClient.fetchQuery(
				orpc.screensAndWireframes.export.queryOptions({
					input: {
						format,
						pins: [...pins],
						selectionNodeIds: selectedNodeId ? [selectedNodeId] : undefined,
						startScreenId: screenId,
					},
				})
			);
			if (result.status !== "ok") {
				return;
			}
			downloadFile(
				result.filename,
				mimeForExport(format),
				bytesFromExport(result.bytes)
			);
		},
		[pins, screenId, selectedNodeId]
	);
	const onExportPng = useCallback(() => {
		onExport(SCREENS_COPY.png).catch(() => undefined);
	}, [onExport]);
	const onExportSvg = useCallback(() => {
		onExport(SCREENS_COPY.svg).catch(() => undefined);
	}, [onExport]);
	const onExportPdf = useCallback(() => {
		onExport(SCREENS_COPY.pdf).catch(() => undefined);
	}, [onExport]);
	const onExportHtml = useCallback(() => {
		onExport(SCREENS_COPY.html).catch(() => undefined);
	}, [onExport]);
	return (
		<>
			<Button onClick={onExportPng} type="button" variant="outline">
				{`${SCREENS_COPY.export} ${SCREENS_COPY.png}`}
			</Button>
			<Button onClick={onExportSvg} type="button" variant="outline">
				{`${SCREENS_COPY.export} ${SCREENS_COPY.svg}`}
			</Button>
			<Button onClick={onExportPdf} type="button" variant="outline">
				{`${SCREENS_COPY.export} ${SCREENS_COPY.pdf}`}
			</Button>
			<Button onClick={onExportHtml} type="button" variant="outline">
				{`${SCREENS_COPY.export} ${SCREENS_COPY.html}`}
			</Button>
		</>
	);
}

function ScreenLifeActions({
	life,
	onArchive,
	onDelete,
	onRestore,
	onTrash,
	onUnarchive,
}: {
	life: string;
	onArchive?: () => void;
	onDelete?: () => void;
	onRestore?: () => void;
	onTrash?: () => void;
	onUnarchive?: () => void;
}) {
	if (life === SCREENS_COPY.active) {
		return (
			<div className="flex flex-wrap gap-2">
				<Button onClick={onArchive} type="button" variant="outline">
					{SCREENS_COPY.archive}
				</Button>
				<Button onClick={onTrash} type="button" variant="outline">
					{SCREENS_COPY.moveToTrash}
				</Button>
			</div>
		);
	}
	if (life === SCREENS_COPY.archived) {
		return (
			<div className="flex flex-wrap gap-2">
				<Button onClick={onUnarchive} type="button" variant="outline">
					{SCREENS_COPY.unarchive}
				</Button>
				<Button onClick={onTrash} type="button" variant="outline">
					{SCREENS_COPY.moveToTrash}
				</Button>
			</div>
		);
	}
	if (life === SCREENS_COPY.inTrash) {
		return (
			<div className="flex flex-wrap gap-2">
				<Button onClick={onRestore} type="button" variant="outline">
					{SCREENS_COPY.restore}
				</Button>
				<Button onClick={onDelete} type="button" variant="outline">
					{SCREENS_COPY.deletePermanently}
				</Button>
			</div>
		);
	}
	return null;
}

function mimeForExport(format: ExportFormat): string {
	if (format === SCREENS_COPY.png) {
		return "image/png";
	}
	if (format === SCREENS_COPY.svg) {
		return "image/svg+xml";
	}
	if (format === SCREENS_COPY.pdf) {
		return "application/pdf";
	}
	return "text/html";
}

function PresentationNodeButton({
	label,
	nodeId,
	onFollow,
}: {
	label: string;
	nodeId: string;
	onFollow: (nodeId: string) => void;
}) {
	const onClick = useCallback(() => {
		onFollow(nodeId);
	}, [nodeId, onFollow]);
	return (
		<Button onClick={onClick} type="button" variant="outline">
			{label}
		</Button>
	);
}

function bytesFromExport(
	bytes: Uint8Array | number[] | { data?: number[] }
): Uint8Array {
	if (bytes instanceof Uint8Array) {
		return new Uint8Array(bytes);
	}
	if (Array.isArray(bytes)) {
		return Uint8Array.from(bytes);
	}
	return Uint8Array.from(bytes.data ?? []);
}

function downloadFile(filename: string, type: string, body: Uint8Array): void {
	const blob = new Blob([body as BlobPart], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
