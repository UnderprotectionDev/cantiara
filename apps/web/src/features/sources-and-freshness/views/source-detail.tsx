import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import SaveSourceVersionForm from "@/features/sources-and-freshness/forms/save-source-version-form";
import { SOURCES_COPY } from "@/features/sources-and-freshness/forms/sources-copy";
import { orpc } from "@/utils/orpc";

export default function SourceDetail({
	projectId,
	sourceId,
}: {
	projectId: string;
	sourceId: string;
}) {
	const source = useQuery(
		orpc.sources.get.queryOptions({ input: { sourceId } })
	);

	if (source.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (source.isError || !source.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<article className="flex flex-col gap-4">
			<header>
				<h2 className="font-medium text-lg">{source.data.title}</h2>
				<p className="text-muted-foreground text-sm">
					{`${SOURCES_COPY.approvedVersion} ${source.data.approvedVersionNumber}`}
				</p>
			</header>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{SOURCES_COPY.address}
				</h3>
				<p className="mt-1 break-all text-sm">{source.data.url}</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{SOURCES_COPY.accessedAt}
				</h3>
				<p className="mt-1 text-sm">{source.data.accessedAt}</p>
			</section>
			<section>
				<h3 className="text-muted-foreground text-xs">
					{SOURCES_COPY.capturedContent}
				</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm">
					{source.data.capturedContent}
				</p>
			</section>
			{source.data.excerpt ? (
				<section>
					<h3 className="text-muted-foreground text-xs">
						{SOURCES_COPY.excerpt}
					</h3>
					<p className="mt-1 whitespace-pre-wrap text-sm">
						{source.data.excerpt}
					</p>
				</section>
			) : null}
			{source.data.provider ? (
				<section>
					<h3 className="text-muted-foreground text-xs">
						{SOURCES_COPY.provider}
					</h3>
					<p className="mt-1 text-sm">
						{`${source.data.provider} · ${source.data.externalRecordType ?? ""} · ${source.data.externalId ?? ""}`}
					</p>
				</section>
			) : null}
			<section>
				<h3 className="text-muted-foreground text-xs">
					{SOURCES_COPY.versions}
				</h3>
				<ol className="mt-1 flex flex-col gap-2">
					{source.data.versions.map((version) => (
						<li className="text-sm" key={version.id}>
							<p>{`${version.versionNumber} · ${version.accessedAt}`}</p>
							<p className="whitespace-pre-wrap text-muted-foreground">
								{version.capturedContent}
							</p>
						</li>
					))}
				</ol>
			</section>
			<SaveSourceVersionForm
				baseRevision={source.data.revision}
				projectId={projectId}
				sourceId={source.data.id}
				url={source.data.url}
			/>
		</article>
	);
}
