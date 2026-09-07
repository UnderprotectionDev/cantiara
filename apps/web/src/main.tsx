import {
	presentFailedMainFlow,
	toMainFlowFailureError,
} from "@cantiara/api/client-shell-failure";
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

function renderStartupFailure(error: unknown, retryAvailable = true) {
	console.error("Application startup failed:", error);
	const presented = presentFailedMainFlow(toMainFlowFailureError(error));
	const errorMessage = document.createElement("div");
	errorMessage.setAttribute("role", "alert");
	errorMessage.setAttribute("aria-live", "assertive");
	const heading = document.createElement("h1");
	heading.textContent = presented.reason;
	const description = document.createElement("p");
	description.textContent = presented.description;
	errorMessage.append(heading, description);
	if (retryAvailable && presented.retry) {
		const retry = document.createElement("button");
		retry.type = "button";
		retry.textContent = presented.retry;
		retry.addEventListener("click", () => {
			retry.disabled = true;
			appRoot.replaceChildren();
			start().catch((retryError: unknown) =>
				renderStartupFailure(retryError, false)
			);
		});
		errorMessage.append(retry);
	}
	appRoot.replaceChildren(errorMessage);
}

start().catch((error: unknown) => {
	renderStartupFailure(error);
});
