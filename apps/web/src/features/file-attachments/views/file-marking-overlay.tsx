import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type ReactNode,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { FILE_ATTACHMENT_COPY } from "../forms/file-attachments-copy";
import FileMarkingCanvas from "./file-marking-canvas";
import {
	type DrawnMark,
	MARKING_TOOLS,
	type MarkingTool,
	marksOnPage,
	regionFromDrag,
} from "./file-marking-geometry";

type OverlayMode = MarkingTool | "point" | "region";

export default function FileMarkingOverlay({
	children,
	fileKind,
	page,
	projectId,
	scope,
	versionId,
}: {
	children: ReactNode;
	fileKind: string;
	page?: number;
	projectId: string | null;
	scope?: { kind: string; projectId?: string };
	versionId: string;
}) {
	const frameRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ height: 0, width: 0 });
	const [mode, setMode] = useState<OverlayMode>("pen");
	const [draft, setDraft] = useState<{
		start: { x: number; y: number };
		points: number[];
	} | null>(null);
	const [title, setTitle] = useState("");
	const [existingWorkId, setExistingWorkId] = useState("");
	const [bindError, setBindError] = useState<string | null>(null);
	const [pendingGeometry, setPendingGeometry] = useState<{
		height?: number;
		kind: "point" | "region";
		width?: number;
		x: number;
		y: number;
	} | null>(null);
	const layer = useQuery({
		...orpc.fileAttachments.getMarkingLayer.queryOptions({
			input: { versionId },
		}),
	});
	const works = useQuery({
		...orpc.workLifecycle.list.queryOptions({
			input: { projectId: projectId ?? "" },
		}),
		enabled: Boolean(projectId),
	});
	const selectedWork = (works.data ?? []).find(
		(work) => work.id === existingWorkId
	);
	const previewBind = useQuery({
		...orpc.fileAttachments.previewLocationBind.queryOptions({
			input: {
				existingWork: selectedWork
					? { id: selectedWork.id, title: selectedWork.title }
					: null,
				fileKind,
				geometry: pendingGeometry
					? bindGeometry(pendingGeometry, page)
					: { kind: "point", x: 0, y: 0 },
				scope:
					scope ??
					(projectId
						? { kind: "project", projectId }
						: { kind: "personal-wiki" }),
				surface: "file-attachment",
				title,
				versionId,
			},
		}),
		enabled: Boolean(pendingGeometry),
	});
	const invalidateLayer = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.fileAttachments.getMarkingLayer.queryKey({
				input: { versionId },
			}),
		});
	}, [versionId]);
	const append = useMutation(
		orpc.fileAttachments.appendMark.mutationOptions({
			onSuccess: async () => {
				await invalidateLayer();
			},
		})
	);
	const undo = useMutation(
		orpc.fileAttachments.undoMark.mutationOptions({
			onSuccess: async () => {
				await invalidateLayer();
			},
		})
	);
	const bind = useMutation(
		orpc.fileAttachments.bindLocation.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed") {
					setPendingGeometry(null);
					setBindError(null);
					await queryClient.invalidateQueries({
						queryKey: orpc.workLifecycle.list.queryKey({
							input: { projectId: projectId ?? "" },
						}),
					});
					await invalidateLayer();
					return;
				}
				setBindError(
					outcome.status === "rejected"
						? rejectCopy(outcome)
						: FILE_ATTACHMENT_COPY.conflict
				);
			},
		})
	);
	const marks: DrawnMark[] =
		layer.data?.status === "committed"
			? marksOnPage(layer.data.layer.marks.filter(isDrawnMark), page)
			: [];
	useLayoutEffect(() => {
		const node = frameRef.current;
		if (!node) {
			return;
		}
		const measure = () => {
			const box = node.getBoundingClientRect();
			setSize({ height: box.height, width: box.width });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	const { height, width } = size;
	const canBindWork = Boolean(projectId);
	const onDrawStart = useCallback(
		(point: { x: number; y: number }) => {
			if (mode === "point") {
				const { x, y } = point;
				setPendingGeometry({ kind: "point", x, y });
				return;
			}
			const { x, y } = point;
			setDraft({ points: [x, y], start: point });
		},
		[mode]
	);
	const onDrawMove = useCallback(
		(point: { x: number; y: number }) => {
			const { x, y } = point;
			setDraft((current) => {
				if (!current) {
					return current;
				}
				if (mode === "pen" || mode === "highlighter") {
					return {
						...current,
						points: [...current.points, x, y],
					};
				}
				return { ...current, points: [x, y] };
			});
		},
		[mode]
	);
	const onDrawEnd = useCallback(() => {
		if (!draft) {
			return;
		}
		if (mode === "region") {
			setPendingGeometry({
				kind: "region",
				...regionFromDraft(draft),
			});
			setDraft(null);
			return;
		}
		if (mode === "point") {
			setDraft(null);
			return;
		}
		append.mutate({
			geometry: geometryForTool(mode, draft),
			page,
			tool: mode,
			versionId,
		});
		setDraft(null);
	}, [append, draft, mode, page, versionId]);
	const onConfirmBind = useCallback(() => {
		if (!pendingGeometry) {
			return;
		}
		if (previewBind.data?.status !== "ok") {
			setBindError(rejectCopy(previewBind.data));
			return;
		}
		bind.mutate({
			existingWorkId: existingWorkId.length > 0 ? existingWorkId : undefined,
			geometry: bindGeometry(pendingGeometry, page),
			idempotencyKey: newIdempotencyKey(),
			previewAcknowledged: true,
			surface: "file-attachment",
			title: title.length > 0 ? title : undefined,
			versionId,
		});
	}, [
		bind,
		existingWorkId,
		page,
		pendingGeometry,
		previewBind.data,
		title,
		versionId,
	]);
	const onSelectMode = useCallback(
		(event: { currentTarget: HTMLButtonElement }) => {
			const next = event.currentTarget.dataset.mode;
			if (next) {
				setMode(next as OverlayMode);
			}
		},
		[]
	);
	const onUndo = useCallback(() => {
		undo.mutate({ versionId });
	}, [undo, versionId]);
	const onSubmitBind = useCallback(
		(event: { preventDefault: () => void }) => {
			event.preventDefault();
			onConfirmBind();
		},
		[onConfirmBind]
	);
	const onTitleChange = useCallback((event: { target: { value: string } }) => {
		setTitle(event.target.value);
	}, []);
	const onExistingWorkChange = useCallback(
		(event: { target: { value: string } }) => {
			setExistingWorkId(event.target.value);
		},
		[]
	);
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-2">
				<p className="w-full font-medium text-xs">
					{FILE_ATTACHMENT_COPY.markingLayer}
				</p>
				{MARKING_TOOLS.map((tool) => (
					<Button
						data-mode={tool}
						key={tool}
						onClick={onSelectMode}
						type="button"
						variant={mode === tool ? "default" : "outline"}
					>
						{toolLabel(tool)}
					</Button>
				))}
				{canBindWork ? (
					<>
						<p className="w-full font-medium text-xs">
							{FILE_ATTACHMENT_COPY.bindAsOrigin}
						</p>
						<Button
							data-mode="point"
							onClick={onSelectMode}
							type="button"
							variant={mode === "point" ? "default" : "outline"}
						>
							{FILE_ATTACHMENT_COPY.point}
						</Button>
						<Button
							data-mode="region"
							onClick={onSelectMode}
							type="button"
							variant={mode === "region" ? "default" : "outline"}
						>
							{FILE_ATTACHMENT_COPY.region}
						</Button>
					</>
				) : null}
				<Button onClick={onUndo} type="button" variant="ghost">
					{FILE_ATTACHMENT_COPY.undo}
				</Button>
			</div>
			<div className="relative" ref={frameRef}>
				{children}
				<div className="absolute inset-0">
					<FileMarkingCanvas
						height={height}
						marks={marks}
						onDrawEnd={onDrawEnd}
						onDrawMove={onDrawMove}
						onDrawStart={onDrawStart}
						width={width}
					/>
				</div>
			</div>
			{pendingGeometry ? (
				<form className="flex flex-col gap-3" onSubmit={onSubmitBind}>
					<p className="font-medium text-xs">
						{FILE_ATTACHMENT_COPY.originLocation} ·{" "}
						{FILE_ATTACHMENT_COPY.preview}
						{previewBind.data?.status === "ok"
							? ` · ${previewBind.data.work.title}`
							: ""}
					</p>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="origin-work-title">
								{FILE_ATTACHMENT_COPY.newWork}
							</FieldLabel>
							<Input
								id="origin-work-title"
								onChange={onTitleChange}
								value={title}
							/>
						</Field>
						{projectId ? (
							<Field>
								<FieldLabel htmlFor="origin-existing-work">
									{FILE_ATTACHMENT_COPY.existingWork}
								</FieldLabel>
								<NativeSelect
									id="origin-existing-work"
									onChange={onExistingWorkChange}
									value={existingWorkId}
								>
									<NativeSelectOption value="">
										{FILE_ATTACHMENT_COPY.newWork}
									</NativeSelectOption>
									{(works.data ?? []).map((work) => (
										<NativeSelectOption key={work.id} value={work.id}>
											{work.title}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
						) : null}
					</FieldGroup>
					{bindError ? <p role="alert">{bindError}</p> : null}
					<Button type="submit">{FILE_ATTACHMENT_COPY.confirm}</Button>
				</form>
			) : null}
			<p className="sr-only">{fileKind}</p>
		</div>
	);
}

function isDrawnMark(mark: {
	geometry: Record<string, unknown>;
	id: string;
	page?: number;
	tool: string;
}): mark is DrawnMark {
	return (MARKING_TOOLS as readonly string[]).includes(mark.tool);
}

function regionFromDraft(draft: {
	points: number[];
	start: { x: number; y: number };
}) {
	return regionFromDrag(draft.start, {
		x: draft.points[0] ?? draft.start.x,
		y: draft.points[1] ?? draft.start.y,
	});
}

function geometryForTool(
	mode: MarkingTool,
	draft: { points: number[]; start: { x: number; y: number } }
): Record<string, unknown> {
	if (mode === "arrow") {
		return {
			x1: draft.start.x,
			x2: draft.points[0] ?? draft.start.x,
			y1: draft.start.y,
			y2: draft.points[1] ?? draft.start.y,
		};
	}
	if (mode === "rectangle") {
		return regionFromDraft(draft);
	}
	return { points: draft.points };
}

function bindGeometry(
	pending: {
		height?: number;
		kind: "point" | "region";
		width?: number;
		x: number;
		y: number;
	},
	page?: number
) {
	if (pending.kind === "point") {
		return { kind: "point" as const, page, x: pending.x, y: pending.y };
	}
	return {
		height: pending.height ?? 0.01,
		kind: "region" as const,
		page,
		width: pending.width ?? 0.01,
		x: pending.x,
		y: pending.y,
	};
}

function rejectCopy(outcome?: { reason?: string }) {
	if (
		outcome?.reason === FILE_ATTACHMENT_COPY.previewRequired ||
		outcome?.reason === FILE_ATTACHMENT_COPY.workRequiresProject ||
		outcome?.reason === FILE_ATTACHMENT_COPY.conflict
	) {
		return outcome.reason;
	}
	return FILE_ATTACHMENT_COPY.unavailable;
}

function toolLabel(tool: MarkingTool): string {
	if (tool === "pen") {
		return FILE_ATTACHMENT_COPY.pen;
	}
	if (tool === "highlighter") {
		return FILE_ATTACHMENT_COPY.highlighter;
	}
	if (tool === "arrow") {
		return FILE_ATTACHMENT_COPY.arrow;
	}
	return FILE_ATTACHMENT_COPY.rectangle;
}
