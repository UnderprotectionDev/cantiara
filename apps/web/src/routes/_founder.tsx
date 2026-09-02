import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PaletteSurfaceProvider } from "@/features/command-palette/components/founder-command-palette";
import Header from "@/features/personal-shell/components/header";
import { InContextPreviewProvider } from "@/features/record-discovery/views/in-context-preview-panel";

export const Route = createFileRoute("/_founder")({
	component: FounderLayout,
});

function FounderLayout() {
	return (
		<PaletteSurfaceProvider surface="founder">
			<InContextPreviewProvider>
				<div className="grid h-svh grid-rows-[auto_1fr]">
					<Header />
					<div className="min-h-0 scroll-pt-14 overflow-auto">
						<Outlet />
					</div>
				</div>
			</InContextPreviewProvider>
		</PaletteSurfaceProvider>
	);
}
