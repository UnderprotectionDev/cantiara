import { createFileRoute } from "@tanstack/react-router";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import PersonalWikiArea from "@/features/personal-wiki/views/personal-wiki-area";
import { PERSONAL_WIKI_COPY } from "@/features/personal-wiki/views/personal-wiki-copy";

export const Route = createFileRoute("/_founder/_auth/wiki")({
	component: PersonalWikiRoute,
});

function PersonalWikiRoute() {
	return (
		<FounderPage title={PERSONAL_WIKI_COPY.personalWiki} wide>
			<PersonalWikiArea />
		</FounderPage>
	);
}
