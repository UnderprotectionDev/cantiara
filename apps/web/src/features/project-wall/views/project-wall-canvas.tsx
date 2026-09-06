import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
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
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { WORK_LIFECYCLE_COPY } from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { PROJECT_WALL_COPY, PROJECT_WALL_DENSITIES } from "./project-wall-copy";

interface WallCard {
	density: string;
	fields: Partial<Record<string, string>>;
	id: string;
	openSourceRecord: string;
	positionX: number;
	positionY: number;
	sourceId: string;
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
	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			const card = wall.data?.cards.find((item) => item.id === event.active.id);
			if (!card || (event.delta.x === 0 && event.delta.y === 0)) {
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
			<DndContext onDragEnd={onDragEnd} sensors={sensors}>
				<div className="relative min-h-[28rem] overflow-hidden rounded-md border bg-muted/30">
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
			<Button className="mt-3" onClick={onOpen} type="button" variant="outline">
				{PROJECT_WALL_COPY.openSourceRecord}
			</Button>
		</article>
	);
}
