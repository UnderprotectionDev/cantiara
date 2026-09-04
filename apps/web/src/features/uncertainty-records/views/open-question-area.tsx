import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { RECORD_DISCOVERY_COPY } from "@/features/record-discovery/views/record-discovery-copy";
import CreateOpenQuestionForm from "@/features/uncertainty-records/forms/create-open-question-form";
import {
	OPEN_QUESTION_LIVES,
	UNCERTAINTY_COPY,
} from "@/features/uncertainty-records/forms/uncertainty-records-copy";
import { orpc } from "@/utils/orpc";

import OpenQuestionDetail from "./open-question-detail";

export default function OpenQuestionArea({
	onOpenQuestionId,
	openQuestionId,
	projectId,
}: {
	onOpenQuestionId?: (openQuestionId: string | null) => void;
	openQuestionId?: string | null;
	projectId: string;
}) {
	const [life, setLife] = useState<string>("");
	const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
	const selectedId = openQuestionId ?? localSelectedId;
	const openQuestions = useQuery(
		orpc.uncertaintyRecords.listOpenQuestions.queryOptions({
			input: {
				projectId,
				...(life === UNCERTAINTY_COPY.open ||
				life === UNCERTAINTY_COPY.answered ||
				life === UNCERTAINTY_COPY.noLongerApplicable
					? { life }
					: {}),
			},
		})
	);
	const onCreated = useCallback(
		(createdId: string) => {
			setLocalSelectedId(createdId);
			onOpenQuestionId?.(createdId);
		},
		[onOpenQuestionId]
	);
	const onSelect = useCallback(
		(id: string) => {
			setLocalSelectedId(id);
			onOpenQuestionId?.(id);
		},
		[onOpenQuestionId]
	);
	const onLifeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setLife(event.target.value);
	}, []);

	if (openQuestions.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (openQuestions.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateOpenQuestionForm onCreated={onCreated} projectId={projectId} />
			<Field>
				<FieldLabel htmlFor="open-question-life-filter">
					{PROJECT_SHELL_COPY.status}
				</FieldLabel>
				<NativeSelect
					id="open-question-life-filter"
					onChange={onLifeChange}
					value={life}
				>
					<NativeSelectOption value="">
						{RECORD_DISCOVERY_COPY.anyScope}
					</NativeSelectOption>
					{OPEN_QUESTION_LIVES.map((item) => (
						<NativeSelectOption key={item} value={item}>
							{item}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{openQuestions.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{UNCERTAINTY_COPY.noOpenQuestions}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{openQuestions.data.map((item) => (
							<li key={item.id}>
								<OpenQuestionRow
									id={item.id}
									life={item.life}
									onSelect={onSelect}
									selected={item.id === selectedId}
									title={item.title}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<OpenQuestionDetail
						openQuestionId={selectedId}
						projectId={projectId}
					/>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{UNCERTAINTY_COPY.openQuestion}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function OpenQuestionRow({
	id,
	life,
	onSelect,
	selected,
	title,
}: {
	id: string;
	life: string;
	onSelect: (id: string) => void;
	selected: boolean;
	title: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="w-full rounded-none border border-input px-2.5 py-2 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			<span className="font-medium">{title}</span>
			<span className="mt-0.5 block text-muted-foreground text-xs">{life}</span>
		</button>
	);
}
