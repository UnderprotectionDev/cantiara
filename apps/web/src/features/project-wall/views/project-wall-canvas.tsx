import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useDraggable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";
import { RELATIONS_COPY } from "@/features/relations/forms/relations-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { WORK_LIFECYCLE_COPY } from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { PROJECT_WALL_COPY, PROJECT_WALL_DENSITIES } from "./project-wall-copy";

interface WallCard {
	density: string;
	fields: Partial<Record<string, string>>;
	id: string;
	locked: boolean;
	openSourceRecord: string;
	positionX: number;
	positionY: number;
	sourceId: string;
}

interface VisualLink {
	fromCardId: string;
	id: string;
	label: string;
	toCardId: string;
}

export default function ProjectWallCanvas({
	onOpenSourceRecord,
	wallId,
}: {
	onOpenSourceRecord?: (sourceId: string) => void;
	wallId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [sourceId, setSourceId] = useState("");
	const [fromCardId, setFromCardId] = useState("");
	const [toCardId, setToCardId] = useState("");
	const [linkLabel, setLinkLabel] = useState("");
	const [visualLinkId, setVisualLinkId] = useState("");
	const [previewReady, setPreviewReady] = useState(false);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
	);
	const wall = useQuery(
		orpc.projectWall.get.queryOptions({ input: { wallId } })
	);
	const works = useQuery({
		...orpc.workLifecycle.list.queryOptions({
			input: { projectId: wall.data?.projectId ?? "" },
		}),
		enabled: Boolean(wall.data?.projectId),
	});
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.projectWall.get.queryKey({ input: { wallId } }),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.projectWall.list.queryKey({
				input: { projectId: wall.data?.projectId ?? "" },
			}),
		});
	}, [wall.data?.projectId, wallId]);
	const place = useMutation(
		orpc.projectWall.placeLiveCard.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					recordSave();
					setSourceId("");
				}
			},
		})
	);
	const layout = useMutation(
		orpc.projectWall.updateLayout.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					recordSave();
				}
			},
		})
	);
	const drawLine = useMutation(
		orpc.projectWall.drawVisualLine.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					recordSave();
					setFromCardId("");
					setToCardId("");
					setLinkLabel("");
				}
			},
		})
	);
	const previewRelation = useMutation(
		orpc.projectWall.previewPersistentRelation.mutationOptions()
	);
	const persistRelation = useMutation(
		orpc.projectWall.createPersistentRelation.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					recordSave();
					setPreviewReady(false);
				}
			},
		})
	);
	const onPlace = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!sourceId) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				place.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						sourceId,
						sourceKind: WORK_LIFECYCLE_COPY.work,
						wallId,
					},
				})
			);
		},
		[attemptOnlineWork, markUnsaved, place, sourceId, wallId]
	);
	const onSourceChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setSourceId(event.target.value);
		},
		[]
	);
	const onFromChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setFromCardId(event.target.value);
	}, []);
	const onToChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setToCardId(event.target.value);
	}, []);
	const onLabelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setLinkLabel(event.target.value);
	}, []);
	const onLinkChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setVisualLinkId(event.target.value);
		setPreviewReady(false);
	}, []);
	const onDrawLine = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!(fromCardId && toCardId && linkLabel)) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				drawLine.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						fromCardId,
						label: linkLabel,
						toCardId,
						wallId,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			drawLine,
			fromCardId,
			linkLabel,
			markUnsaved,
			toCardId,
			wallId,
		]
	);
	const onPersistentRelation = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!visualLinkId) {
				return;
			}
			if (!previewReady) {
				previewRelation
					.mutateAsync({
						type: RELATIONS_COPY.related,
						visualLinkId,
						wallId,
					})
					.then((result) => {
						if (result.status === "ok") {
							setPreviewReady(true);
						}
					})
					.catch(() => undefined);
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				persistRelation.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						previewAcknowledged: true,
						type: RELATIONS_COPY.related,
						visualLinkId,
						wallId,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			markUnsaved,
			persistRelation,
			previewReady,
			previewRelation,
			visualLinkId,
			wallId,
		]
	);
	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			const card = wall.data?.cards.find((item) => item.id === event.active.id);
			if (
				!card ||
				card.locked ||
				(event.delta.x === 0 && event.delta.y === 0)
			) {
				return;
			}
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				layout.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						cardId: card.id,
						positionX: card.positionX + event.delta.x,
						positionY: card.positionY + event.delta.y,
						wallId,
					},
				})
			);
		},
		[attemptOnlineWork, layout, markUnsaved, wall.data?.cards, wallId]
	);

	if (!wall.data) {
		return null;
	}

	const preview =
		previewRelation.data && previewRelation.data.status === "ok"
			? previewRelation.data.preview
			: null;

	return (
		<div className="flex flex-col gap-4">
			<form className="flex flex-wrap items-end gap-3" onSubmit={onPlace}>
				<Field>
					<FieldLabel htmlFor={`place-work-${wallId}`}>
						{WORK_LIFECYCLE_COPY.work}
					</FieldLabel>
					<NativeSelect
						id={`place-work-${wallId}`}
						onChange={onSourceChange}
						value={sourceId}
					>
						<NativeSelectOption value="">
							{WORK_LIFECYCLE_COPY.noWork}
						</NativeSelectOption>
						{(works.data ?? []).map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.key} {item.title}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button type="submit">{PROJECT_WALL_COPY.placeLiveCard}</Button>
			</form>
			<form className="flex flex-wrap items-end gap-3" onSubmit={onDrawLine}>
				<Field>
					<FieldLabel htmlFor={`visual-from-${wallId}`}>
						{PROJECT_WALL_COPY.visualLink}
					</FieldLabel>
					<NativeSelect
						id={`visual-from-${wallId}`}
						onChange={onFromChange}
						value={fromCardId}
					>
						<NativeSelectOption value="" />
						{wall.data.cards.map((card) => (
							<NativeSelectOption key={card.id} value={card.id}>
								{card.fields.Title}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor={`visual-to-${wallId}`}>
						{PROJECT_WALL_COPY.visualLink}
					</FieldLabel>
					<NativeSelect
						id={`visual-to-${wallId}`}
						onChange={onToChange}
						value={toCardId}
					>
						<NativeSelectOption value="" />
						{wall.data.cards.map((card) => (
							<NativeSelectOption key={card.id} value={card.id}>
								{card.fields.Title}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor={`visual-label-${wallId}`}>
						{PROJECT_WALL_COPY.visualLink}
					</FieldLabel>
					<Input
						id={`visual-label-${wallId}`}
						onChange={onLabelChange}
						value={linkLabel}
					/>
				</Field>
				<Button type="submit">{PROJECT_WALL_COPY.visualLink}</Button>
			</form>
			<form
				className="flex flex-wrap items-end gap-3"
				onSubmit={onPersistentRelation}
			>
				<Field>
					<FieldLabel htmlFor={`persist-${wallId}`}>
						{PROJECT_WALL_COPY.createPersistentRelation}
					</FieldLabel>
					<NativeSelect
						id={`persist-${wallId}`}
						onChange={onLinkChange}
						value={visualLinkId}
					>
						<NativeSelectOption value="" />
						{wall.data.visualLinks.map((link) => (
							<NativeSelectOption key={link.id} value={link.id}>
								{link.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button type="submit">
					{PROJECT_WALL_COPY.createPersistentRelation}
				</Button>
			</form>
			{preview ? (
				<p className="text-sm">
					{preview.from.title} {preview.type} {preview.to.title}
				</p>
			) : null}
			<DndContext onDragEnd={onDragEnd} sensors={sensors}>
				<div className="relative min-h-[28rem] overflow-hidden rounded-md border bg-muted/30">
					<svg
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 h-full w-full"
					>
						<defs>
							<marker
								id="wall-arrow"
								markerHeight="6"
								markerWidth="6"
								orient="auto"
								refX="6"
								refY="3"
							>
								<path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
							</marker>
						</defs>
						{wall.data.visualLinks.map((link) => (
							<VisualLine cards={wall.data.cards} key={link.id} link={link} />
						))}
					</svg>
					{wall.data.cards.map((card) => (
						<LiveCard
							card={card}
							key={card.id}
							onOpenSourceRecord={onOpenSourceRecord}
							onWallChanged={invalidate}
							wallId={wallId}
						/>
					))}
				</div>
			</DndContext>
		</div>
	);
}

function VisualLine({ cards, link }: { cards: WallCard[]; link: VisualLink }) {
	const from = cards.find((card) => card.id === link.fromCardId);
	const to = cards.find((card) => card.id === link.toCardId);
	if (!(from && to)) {
		return null;
	}
	const x1 = from.positionX + 112;
	const y1 = from.positionY + 24;
	const x2 = to.positionX + 112;
	const y2 = to.positionY + 24;
	return (
		<g>
			<line
				markerEnd="url(#wall-arrow)"
				stroke="currentColor"
				strokeWidth="1.5"
				x1={x1}
				x2={x2}
				y1={y1}
				y2={y2}
			/>
			<text
				className="fill-current text-[10px]"
				textAnchor="middle"
				x={(x1 + x2) / 2}
				y={(y1 + y2) / 2 - 6}
			>
				{link.label}
			</text>
		</g>
	);
}

function LiveCard({
	card,
	onOpenSourceRecord,
	onWallChanged,
	wallId,
}: {
	card: WallCard;
	onOpenSourceRecord?: (sourceId: string) => void;
	onWallChanged: () => Promise<void>;
	wallId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			disabled: card.locked,
			id: card.id,
		});
	const density = useMutation(
		orpc.projectWall.updateDensity.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await onWallChanged();
					recordSave();
				}
			},
		})
	);
	const lock = useMutation(
		orpc.projectWall.setLockPosition.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await onWallChanged();
					recordSave();
				}
			},
		})
	);
	const onDensityChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				density.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						cardId: card.id,
						density: event.target.value,
						wallId,
					},
				})
			);
		},
		[attemptOnlineWork, card.id, density, markUnsaved, wallId]
	);
	const onLock = useCallback(() => {
		markUnsaved();
		attemptOnlineWork("record-create", () =>
			lock.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					cardId: card.id,
					locked: !card.locked,
					wallId,
				},
			})
		);
	}, [attemptOnlineWork, card.id, card.locked, lock, markUnsaved, wallId]);
	const onOpen = useCallback(() => {
		onOpenSourceRecord?.(card.sourceId);
	}, [card.sourceId, onOpenSourceRecord]);

	return (
		<article
			className="absolute w-56 rounded-md border bg-background p-3 shadow-sm"
			ref={setNodeRef}
			style={{
				left: card.positionX,
				opacity: isDragging ? 0.6 : undefined,
				top: card.positionY,
				transform: CSS.Translate.toString(transform),
			}}
		>
			<button
				className="mb-2 block w-full cursor-grab text-left font-medium text-sm"
				disabled={card.locked}
				type="button"
				{...listeners}
				{...attributes}
			>
				{card.fields.Title}
			</button>
			<dl className="flex flex-col gap-1 text-sm">
				{Object.entries(card.fields).map(([label, value]) => (
					<div key={label}>
						<dt className="text-muted-foreground text-xs">{label}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>
			<NativeSelect
				aria-label={card.density}
				className="mt-3"
				id={`density-${card.id}`}
				onChange={onDensityChange}
				value={card.density}
			>
				{PROJECT_WALL_DENSITIES.map((item) => (
					<NativeSelectOption key={item} value={item}>
						{item}
					</NativeSelectOption>
				))}
			</NativeSelect>
			<Button
				aria-pressed={card.locked}
				className="mt-3"
				onClick={onLock}
				type="button"
				variant={card.locked ? "default" : "outline"}
			>
				{PROJECT_WALL_COPY.lockPosition}
			</Button>
			<Button className="mt-3" onClick={onOpen} type="button" variant="outline">
				{PROJECT_WALL_COPY.openSourceRecord}
			</Button>
		</article>
	);
}
