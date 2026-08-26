import { Button } from "@cantiara/ui/components/button";
import { useCallback } from "react";

import { PROJECT_SHELL_COPY, projectShellAnchor } from "./project-shell-copy";
import { useConfigureProject } from "./use-configure-project";

interface AreaView {
	enabled: boolean;
	name: string;
	pinned: boolean;
}

export default function ProjectAreasForm({
	areas,
	label,
	projectId,
	reservedAnchors,
	revision,
	showEnablement,
	showRestore,
}: {
	areas: readonly AreaView[];
	label: string;
	projectId: string;
	reservedAnchors?: ReadonlySet<string>;
	revision: number;
	showEnablement: boolean;
	showRestore: boolean;
}) {
	const { error, isPending, run } = useConfigureProject(projectId, revision);
	const onRestore = useCallback(() => {
		run({ action: "restore-default-navigation" }).catch(() => undefined);
	}, [run]);
	return (
		<div>
			{showRestore ? (
				<Button
					disabled={isPending}
					onClick={onRestore}
					type="button"
					variant="outline"
				>
					{PROJECT_SHELL_COPY.restoreDefaultNavigation}
				</Button>
			) : null}
			<ul aria-label={label}>
				{areas.map((area) => (
					<AreaRow
						area={area}
						disabled={isPending}
						key={area.name}
						reservedAnchors={reservedAnchors}
						run={run}
						showEnablement={showEnablement}
					/>
				))}
			</ul>
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}

function AreaRow({
	area,
	disabled,
	reservedAnchors,
	run,
	showEnablement,
}: {
	area: AreaView;
	disabled: boolean;
	reservedAnchors?: ReadonlySet<string>;
	run: ReturnType<typeof useConfigureProject>["run"];
	showEnablement: boolean;
}) {
	const anchor = projectShellAnchor(area.name);
	const onEnablement = useCallback(() => {
		run({
			action: "set-area-enabled",
			area: area.name,
			enabled: !area.enabled,
		}).catch(() => undefined);
	}, [area.enabled, area.name, run]);
	const onPin = useCallback(() => {
		run({
			action: area.pinned ? "unpin-from-navigation" : "pin-to-navigation",
			area: area.name,
		}).catch(() => undefined);
	}, [area.name, area.pinned, run]);
	return (
		<li id={reservedAnchors?.has(anchor) ? undefined : anchor}>
			<p>{area.name}</p>
			{showEnablement ? (
				<Button
					disabled={disabled}
					onClick={onEnablement}
					type="button"
					variant="outline"
				>
					{area.enabled ? PROJECT_SHELL_COPY.hide : PROJECT_SHELL_COPY.enable}
				</Button>
			) : null}
			<Button
				aria-pressed={area.pinned}
				disabled={disabled}
				onClick={onPin}
				type="button"
				variant={area.pinned ? "secondary" : "outline"}
			>
				{PROJECT_SHELL_COPY.pinToNavigation}
			</Button>
		</li>
	);
}
