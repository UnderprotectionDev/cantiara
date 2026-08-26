import { Toaster } from "@cantiara/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AppearanceProvider } from "@/features/account-preferences/views/appearance-provider";
import Header from "@/features/personal-shell/components/header";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		links: [
			{
				href: "/favicon.ico",
				rel: "icon",
			},
		],
		meta: [
			{
				title: "cantiara",
			},
			{
				content: "cantiara is a web application",
				name: "description",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<AppearanceProvider>
				<div className="grid h-svh grid-rows-[auto_1fr]">
					<Header />
					<Outlet />
				</div>
				<Toaster richColors />
			</AppearanceProvider>
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
		</>
	);
}
