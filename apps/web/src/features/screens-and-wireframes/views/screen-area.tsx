import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Spinner } from "@cantiara/ui/components/spinner";
import { Switch } from "@cantiara/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import CreateScreenForm from "@/features/screens-and-wireframes/forms/create-screen-form";
import { SCREENS_COPY } from "@/features/screens-and-wireframes/forms/screens-copy";
import { orpc } from "@/utils/orpc";

import ScreenDetail from "./screen-detail";

export default function ScreenArea({ projectId }: { projectId: string }) {
	const [includeArchived, setIncludeArchived] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [trash, setTrash] = useState(false);
	const screens = useQuery(
		orpc.screensAndWireframes.list.queryOptions({
			input: {
				includeArchived: trash ? false : includeArchived,
				projectId,
				trash,
			},
		})
	);
	const onCreated = useCallback((createdId: string) => {
		setSelectedId(createdId);
		setTrash(false);
	}, []);
	const onSelect = useCallback((id: string) => {
		setSelectedId(id);
	}, []);
	const onCleared = useCallback(() => {
		setSelectedId(null);
	}, []);
	const onIncludeArchived = useCallback((checked: boolean) => {
		setIncludeArchived(checked);
		setTrash(false);
	}, []);
	const onTrash = useCallback((checked: boolean) => {
		setTrash(checked);
		if (checked) {
			setIncludeArchived(false);
		}
	}, []);

	if (screens.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (screens.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateScreenForm onCreated={onCreated} projectId={projectId} />
			<div className="flex flex-wrap gap-4">
				<Field className="flex flex-row items-center gap-2">
					<Switch
						checked={includeArchived}
						id="screen-include-archived"
						onCheckedChange={onIncludeArchived}
					/>
					<FieldLabel htmlFor="screen-include-archived">
						{SCREENS_COPY.includeArchived}
					</FieldLabel>
				</Field>
				<Field className="flex flex-row items-center gap-2">
					<Switch
						checked={trash}
						id="screen-in-trash"
						onCheckedChange={onTrash}
					/>
					<FieldLabel htmlFor="screen-in-trash">
						{SCREENS_COPY.inTrash}
					</FieldLabel>
				</Field>
			</div>
			<div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{screens.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>
								{trash ? SCREENS_COPY.noScreensInTrash : SCREENS_COPY.noScreens}
							</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{screens.data.map((item) => (
							<li key={item.id}>
								<ScreenRow
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
					<ScreenDetail
						onCleared={onCleared}
						projectId={projectId}
						screenId={selectedId}
					/>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{SCREENS_COPY.screen}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function ScreenRow({
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
