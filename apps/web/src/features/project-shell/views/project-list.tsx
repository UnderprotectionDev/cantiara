import { Skeleton } from "@cantiara/ui/components/skeleton";
import { cn } from "@cantiara/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

export default function ProjectList({ compact }: { compact?: boolean }) {
	const projects = useQuery(orpc.projectShell.list.queryOptions());

	if (projects.isPending) {
		return (
			<ul className="flex flex-col gap-1 px-2">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
			</ul>
		);
	}

	if (projects.data?.length) {
		return (
			<ul className={compact ? undefined : "divide-y border-y"}>
				{projects.data.map((project) => (
					<li key={project.id}>
						<Link
							className={cn(
								"flex outline-none transition-colors duration-200 ease-out hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring active:opacity-80",
								compact
									? "flex-col gap-0.5 px-2 py-1.5"
									: "items-center justify-between gap-6 px-1 py-3"
							)}
							params={{ projectId: project.id }}
							to="/projects/$projectId"
						>
							<span className="truncate font-medium text-sm">
								{project.name}
							</span>
							<span className="font-mono text-muted-foreground text-xs">
								{project.shortCode}
							</span>
						</Link>
					</li>
				))}
			</ul>
		);
	}

	return (
		<p
			className={cn(
				compact ? "px-2 text-xs" : "text-sm",
				"text-muted-foreground"
			)}
		>
			{PROJECT_SHELL_COPY.noProjects}
		</p>
	);
}
