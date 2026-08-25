import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { loadDesktopSessionToken } from "./features/account-access/forms/tauri-session-token";
import { listenForDesktopGitHubSignIn } from "./features/account-access/forms/tauri-sign-in";
import Loader from "./features/personal-shell/components/loader";
import { routeTree } from "./routeTree.gen";
import { orpc, queryClient } from "./utils/orpc";

const router = createRouter({
	context: { orpc, queryClient },
	defaultPendingComponent: () => <Loader />,
	defaultPreload: "intent",
	routeTree,
	scrollRestoration: true,
	Wrap({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	},
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element not found");
}

const appRoot = rootElement;

async function start() {
	await loadDesktopSessionToken();
	await listenForDesktopGitHubSignIn(() => {
		window.location.assign("/dashboard");
	});

	if (!appRoot.innerHTML) {
		const root = ReactDOM.createRoot(appRoot);
		root.render(<RouterProvider router={router} />);
	}
}

start().catch(() => undefined);
