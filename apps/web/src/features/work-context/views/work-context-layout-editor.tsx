import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { PROJECT_SHELL_COPY } from "../../project-shell/forms/project-shell-copy";
import {
	WORK_TYPES,
	type WorkType,
} from "../../work-lifecycle/forms/work-lifecycle-copy";

import { WORK_CONTEXT_COPY } from "./work-context-copy";

interface LayoutSectionDraft {
	condition?: {
		evidenceRole?: string;
		recordType?: string;
		relationType?: string;
		status?: string;
	};
	hidden: boolean;
	kind: "custom" | "prepared";
	name: string;
}

function fieldValue(
	event: ChangeEvent<HTMLSelectElement> | ChangeEvent<HTMLInputElement>
) {
	return event.currentTarget.value;
}

export default function WorkContextLayoutEditor({
	projectId,
}: {
	projectId: string;
}) {
	const [workType, setWorkType] = useState<WorkType>("Feature");
	const [draft, setDraft] = useState<LayoutSectionDraft[] | null>(null);
	const [customName, setCustomName] = useState("");
	const [recordType, setRecordType] = useState("");
	const [relationType, setRelationType] = useState("");
	const [evidenceRole, setEvidenceRole] = useState("");
	const [status, setStatus] = useState("");
	const catalog = useQuery(orpc.workContext.catalog.queryOptions());
	const layout = useQuery({
		...orpc.workContext.getLayout.queryOptions({
			input: { projectId, workType },
		}),
	});
	const sections = draft ?? layout.data?.sections ?? [];
	const preview = useQuery({
		...orpc.workContext.previewLayout.queryOptions({
			input: { projectId, sections: sections as never, workType },
		}),
		enabled: draft !== null,
	});
	const apply = useMutation(
		orpc.workContext.applyLayout.mutationOptions({
			onSuccess: async () => {
				setDraft(null);
				await queryClient.invalidateQueries({
					queryKey: orpc.workContext.getLayout.queryKey({
						input: { projectId, workType },
					}),
				});
			},
		})
	);
	const undo = useMutation(
		orpc.workContext.undoLayout.mutationOptions({
			onSuccess: async () => {
				setDraft(null);
				await queryClient.invalidateQueries({
					queryKey: orpc.workContext.getLayout.queryKey({
						input: { projectId, workType },
					}),
				});
			},
		})
	);
	const onWorkType = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		const next = event.currentTarget.value;
		if (
			next === "Bug" ||
			next === "Feature" ||
			next === "Improvement" ||
			next === "Research" ||
			next === "Task"
		) {
			setWorkType(next);
			setDraft(null);
		}
	}, []);
	const move = useCallback(
		(index: number, delta: number) => {
			setDraft((current) => {
				const source = current ?? sections;
				const next = [...source];
				const target = index + delta;
				if (target < 0 || target >= next.length) {
					return source;
				}
				const [item] = next.splice(index, 1);
				if (!item) {
					return source;
				}
				next.splice(target, 0, item);
				return next;
			});
		},
		[sections]
	);
	const toggleHidden = useCallback(
		(index: number) => {
			setDraft((current) => {
				const source = current ?? sections;
				return source.map((section, itemIndex) =>
					itemIndex === index
						? { ...section, hidden: !section.hidden }
						: section
				);
			});
		},
		[sections]
	);
	const onCustomName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setCustomName(fieldValue(event));
	}, []);
	const onRecordType = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setRecordType(fieldValue(event));
	}, []);
	const onRelationType = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setRelationType(fieldValue(event));
		},
		[]
	);
	const onEvidenceRole = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setEvidenceRole(fieldValue(event));
		},
		[]
	);
	const onStatus = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setStatus(fieldValue(event));
	}, []);
	const addCustom = useCallback(() => {
		if (customName.trim().length === 0) {
			return;
		}
		const condition: LayoutSectionDraft["condition"] = {};
		if (recordType.length > 0) {
			condition.recordType = recordType;
		}
		if (relationType.length > 0) {
			condition.relationType = relationType;
		}
		if (evidenceRole.length > 0) {
			condition.evidenceRole = evidenceRole;
		}
		if (status.length > 0) {
			condition.status = status;
		}
		if (Object.keys(condition).length === 0) {
			return;
		}
		setDraft((current) => [
			...(current ?? sections),
			{
				condition,
				hidden: false,
				kind: "custom",
				name: customName.trim(),
			},
		]);
		setCustomName("");
	}, [customName, evidenceRole, recordType, relationType, sections, status]);
	const onAddCustom = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			addCustom();
		},
		[addCustom]
	);
	const onConfirm = useCallback(() => {
		apply.mutate({
			idempotencyKey: newIdempotencyKey(),
			payload: { projectId, sections: sections as never, workType },
		});
	}, [apply, projectId, sections, workType]);
	const onUndo = useCallback(() => {
		undo.mutate({
			idempotencyKey: newIdempotencyKey(),
			projectId,
			workType,
		});
	}, [projectId, undo, workType]);
	const catalogData = catalog.data;
	const previewLines = useMemo(() => {
		if (!preview.data) {
			return [];
		}
		return [
			...preview.data.affectedWorkTypes.map((type) => type),
			...preview.data.sectionDiff.hidden.map(
				(name) => `${WORK_CONTEXT_COPY.hide}: ${name}`
			),
			...preview.data.sectionDiff.added.map(
				(name) => `${WORK_CONTEXT_COPY.add}: ${name}`
			),
		];
	}, [preview.data]);
	return (
		<section
			aria-label={PROJECT_SHELL_COPY.workContextCardLayout}
			className="flex flex-col gap-3"
		>
			<h2 className="font-medium text-sm">
				{PROJECT_SHELL_COPY.workContextCardLayout}
			</h2>
			<Field>
				<FieldLabel htmlFor="work-context-layout-type">
					{WORK_CONTEXT_COPY.type}
				</FieldLabel>
				<NativeSelect
					id="work-context-layout-type"
					onChange={onWorkType}
					value={workType}
				>
					{WORK_TYPES.map((type) => (
						<NativeSelectOption key={type} value={type}>
							{type}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<ol className="flex flex-col gap-2">
				{sections.map((section, index) => (
					<LayoutSectionRow
						index={index}
						key={`${section.kind}:${section.name}`}
						onMove={move}
						onToggleHidden={toggleHidden}
						section={section}
					/>
				))}
			</ol>
			<form className="flex flex-col gap-2" onSubmit={onAddCustom}>
				<Field>
					<FieldLabel htmlFor="custom-section-name">
						{WORK_CONTEXT_COPY.addCustomSection}
					</FieldLabel>
					<Input
						id="custom-section-name"
						onChange={onCustomName}
						value={customName}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="custom-record-type">
						{WORK_CONTEXT_COPY.recordType}
					</FieldLabel>
					<NativeSelect
						id="custom-record-type"
						onChange={onRecordType}
						value={recordType}
					>
						<NativeSelectOption value="">—</NativeSelectOption>
						{(catalogData?.recordTypes ?? []).map((type) => (
							<NativeSelectOption key={type} value={type}>
								{type}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="custom-relation-type">
						{WORK_CONTEXT_COPY.relation}
					</FieldLabel>
					<NativeSelect
						id="custom-relation-type"
						onChange={onRelationType}
						value={relationType}
					>
						<NativeSelectOption value="">—</NativeSelectOption>
						{(catalogData?.relationTypes ?? []).map((type) => (
							<NativeSelectOption key={type} value={type}>
								{type}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="custom-evidence-role">
						{WORK_CONTEXT_COPY.evidenceRole}
					</FieldLabel>
					<NativeSelect
						id="custom-evidence-role"
						onChange={onEvidenceRole}
						value={evidenceRole}
					>
						<NativeSelectOption value="">—</NativeSelectOption>
						{(catalogData?.evidenceRoles ?? []).map((role) => (
							<NativeSelectOption key={role} value={role}>
								{role}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="custom-status">
						{WORK_CONTEXT_COPY.status}
					</FieldLabel>
					<NativeSelect id="custom-status" onChange={onStatus} value={status}>
						<NativeSelectOption value="">—</NativeSelectOption>
						{(catalogData?.statusConditions ?? []).map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button size="sm" type="submit">
					{WORK_CONTEXT_COPY.addCustomSection}
				</Button>
			</form>
			{preview.data ? (
				<section aria-label={WORK_CONTEXT_COPY.impactPreview}>
					<h3 className="font-medium text-sm">
						{WORK_CONTEXT_COPY.impactPreview}
					</h3>
					<ul className="text-sm">
						{previewLines.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</section>
			) : null}
			<div className="flex flex-wrap gap-2">
				<Button
					disabled={draft === null}
					onClick={onConfirm}
					size="sm"
					type="button"
				>
					{WORK_CONTEXT_COPY.confirm}
				</Button>
				<Button onClick={onUndo} size="sm" type="button" variant="outline">
					{WORK_CONTEXT_COPY.undo}
				</Button>
			</div>
		</section>
	);
}

function LayoutSectionRow({
	index,
	onMove,
	onToggleHidden,
	section,
}: {
	index: number;
	onMove: (index: number, delta: number) => void;
	onToggleHidden: (index: number) => void;
	section: LayoutSectionDraft;
}) {
	const hideOrShow = section.hidden
		? WORK_CONTEXT_COPY.show
		: WORK_CONTEXT_COPY.hide;
	const onHide = useCallback(() => {
		onToggleHidden(index);
	}, [index, onToggleHidden]);
	const onMoveUp = useCallback(() => {
		onMove(index, -1);
	}, [index, onMove]);
	const onMoveDown = useCallback(() => {
		onMove(index, 1);
	}, [index, onMove]);
	return (
		<li className="flex flex-wrap items-center gap-2">
			<span className="text-sm">{section.name}</span>
			<Button
				aria-label={`${hideOrShow} ${section.name}`}
				onClick={onHide}
				size="sm"
				type="button"
				variant="outline"
			>
				{hideOrShow}
			</Button>
			<Button
				aria-label={`${WORK_CONTEXT_COPY.moveUp} ${section.name}`}
				onClick={onMoveUp}
				size="sm"
				type="button"
				variant="ghost"
			>
				{WORK_CONTEXT_COPY.moveUp}
			</Button>
			<Button
				aria-label={`${WORK_CONTEXT_COPY.moveDown} ${section.name}`}
				onClick={onMoveDown}
				size="sm"
				type="button"
				variant="ghost"
			>
				{WORK_CONTEXT_COPY.moveDown}
			</Button>
		</li>
	);
}
