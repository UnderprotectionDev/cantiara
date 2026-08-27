import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PaletteSurfaceProvider } from "@/features/command-palette/components/founder-command-palette";
import Header from "@/features/personal-shell/components/header";

export const Route = createFileRoute("/_founder")({
	component: FounderLayout,
});

function FounderLayout() {
	return (
		<PaletteSurfaceProvider surface="founder">
			<div className="grid h-svh grid-rows-[auto_1fr]">
				<Header />
				<div className="min-h-0 overflow-auto">
					<Outlet />
				</div>
			</div>
		</PaletteSurfaceProvider>
	);
}
