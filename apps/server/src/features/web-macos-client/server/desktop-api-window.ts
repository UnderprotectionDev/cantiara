import {
	DESKTOP_API_HEADER,
	evaluateDesktopApiWindow,
	publicProcedure,
	signedDesktopApiCatalog,
} from "@cantiara/api";

export const clientShell = {
	desktopApiWindow: publicProcedure.handler(({ context }) =>
		evaluateDesktopApiWindow(
			context.request.headers.get(DESKTOP_API_HEADER),
			signedDesktopApiCatalog,
			new Date()
		)
	),
};
