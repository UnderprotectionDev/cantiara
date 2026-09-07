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

	const rows = screens.data ?? [];
	const selected = selectedId ?? rows[0]?.id ?? null;

	return (
		<div className="flex min-w-0 flex-col gap-6">
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
			{rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>
							{trash ? SCREENS_COPY.noScreensInTrash : SCREENS_COPY.noScreens}
						</EmptyTitle>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="flex min-w-0 flex-wrap gap-1">
					{rows.map((item) => (
						<li className="min-w-0" key={item.id}>
							<ScreenRow
								id={item.id}
								life={item.life}
								onSelect={onSelect}
								selected={item.id === selected}
								title={item.title}
							/>
						</li>
					))}
				</ul>
			)}
			{selected ? (
				<ScreenDetail
					onCleared={onCleared}
					projectId={projectId}
					screenId={selected}
				/>
			) : null}
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
			className={
				selected
					? "min-w-0 truncate rounded-sm bg-muted px-2 py-1.5 text-left font-medium text-foreground text-sm"
					: "min-w-0 truncate rounded-sm px-2 py-1.5 text-left text-foreground text-sm hover:bg-muted/60"
			}
			onClick={onClick}
			type="button"
		>
			{title}
			<span className="ml-2 text-muted-foreground text-xs">{life}</span>
		</button>
	);
}
