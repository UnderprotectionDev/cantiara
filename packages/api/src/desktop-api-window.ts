import { ORPCError } from "@orpc/server";

export const DESKTOP_API_HEADER = "Cantiara-Desktop-Api";
export const DESKTOP_API_WINDOW_DAYS = 30;
export const UPDATE_REQUIRED = "Update required";

const WINDOW_MS = DESKTOP_API_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type DesktopApiWindowStatus = "accepted" | "update-required";

export interface SignedDesktopApiContract {
	contract: string;
	shippedAt: Date;
}

export interface SignedDesktopApiCatalog {
	current: SignedDesktopApiContract;
	previous: { contract: string } | null;
}

export interface DesktopApiWindowDecision {
	status: DesktopApiWindowStatus;
}

export const signedDesktopApiCatalog: SignedDesktopApiCatalog = {
	current: {
		contract: "1",
		shippedAt: new Date("2026-08-26T00:00:00.000Z"),
	},
	previous: null,
};

export const DESKTOP_API_CONTRACT = signedDesktopApiCatalog.current.contract;

export function evaluateDesktopApiWindow(
	contract: string | null | undefined,
	catalog: SignedDesktopApiCatalog,
	now: Date
): DesktopApiWindowDecision {
	if (!contract) {
		return { status: "accepted" };
	}
	if (contract === catalog.current.contract) {
		return { status: "accepted" };
	}
	if (
		catalog.previous &&
		contract === catalog.previous.contract &&
		now.getTime() - catalog.current.shippedAt.getTime() <= WINDOW_MS
	) {
		return { status: "accepted" };
	}
	return { status: "update-required" };
}

export function assertDesktopApiWriteAllowed(
	contract: string | null | undefined,
	catalog: SignedDesktopApiCatalog,
	now: Date
): void {
	if (
		evaluateDesktopApiWindow(contract, catalog, now).status ===
		"update-required"
	) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: UPDATE_REQUIRED,
		});
	}
}

export function desktopApiContractFrom(request: Request): string | null {
	return request.headers.get(DESKTOP_API_HEADER);
}
