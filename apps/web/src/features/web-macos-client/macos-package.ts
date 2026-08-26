export interface MacosPackageCandidate {
	backend: "hono-bun" | "local-dev" | "rust-data-layer";
	euRegionPicker: boolean;
	nativeShells: Array<"macos" | "windows" | "linux">;
	notarized: boolean;
	operationalBackupUi: boolean;
	pwaInstall: boolean;
	selfHostInstaller: boolean;
	signed: boolean;
	signingIdentity?: string;
	sourceOfTruth: "neon" | "local-postgres" | "local-files";
	supportMatrix: {
		cleanInstall: boolean;
		frozenAt: string;
		macosMajors: readonly number[];
	};
}

export type MacosPackageRejectReason =
	| "unsigned-skeleton"
	| "not-notarized"
	| "local-backend"
	| "rust-data-layer"
	| "local-source-of-truth"
	| "non-macos-native-shell"
	| "pwa-install"
	| "self-host-installer"
	| "eu-region-picker"
	| "operational-backup-ui"
	| "support-matrix";

export type MacosPackageEvaluation =
	| { status: "product-candidate" }
	| { status: "not-product-behavior"; reason: MacosPackageRejectReason };

export const macosSupportMatrix = {
	cleanInstall: true,
	frozenAt: "2026-08-26",
	macosMajors: [26, 15, 14],
} as const;

export function supportMatrixMajors(currentReleasedMajor: number): number[] {
	if (currentReleasedMajor !== macosSupportMatrix.macosMajors[0]) {
		return [];
	}
	return [...macosSupportMatrix.macosMajors];
}

export function evaluateMacosPackageCandidate(
	candidate: MacosPackageCandidate
): MacosPackageEvaluation {
	if (!candidate.signed || candidate.signingIdentity === "-") {
		return { reason: "unsigned-skeleton", status: "not-product-behavior" };
	}

	if (!candidate.notarized) {
		return { reason: "not-notarized", status: "not-product-behavior" };
	}

	if (candidate.backend === "local-dev") {
		return { reason: "local-backend", status: "not-product-behavior" };
	}

	if (candidate.backend === "rust-data-layer") {
		return { reason: "rust-data-layer", status: "not-product-behavior" };
	}

	if (candidate.sourceOfTruth !== "neon") {
		return {
			reason: "local-source-of-truth",
			status: "not-product-behavior",
		};
	}

	if (
		candidate.nativeShells.length !== 1 ||
		candidate.nativeShells[0] !== "macos"
	) {
		return {
			reason: "non-macos-native-shell",
			status: "not-product-behavior",
		};
	}

	if (candidate.pwaInstall) {
		return { reason: "pwa-install", status: "not-product-behavior" };
	}

	if (candidate.selfHostInstaller) {
		return { reason: "self-host-installer", status: "not-product-behavior" };
	}

	if (candidate.euRegionPicker) {
		return { reason: "eu-region-picker", status: "not-product-behavior" };
	}

	if (candidate.operationalBackupUi) {
		return {
			reason: "operational-backup-ui",
			status: "not-product-behavior",
		};
	}

	if (
		candidate.supportMatrix.frozenAt !== macosSupportMatrix.frozenAt ||
		candidate.supportMatrix.cleanInstall !== macosSupportMatrix.cleanInstall ||
		!sameMajors(
			candidate.supportMatrix.macosMajors,
			macosSupportMatrix.macosMajors
		)
	) {
		return { reason: "support-matrix", status: "not-product-behavior" };
	}

	return { status: "product-candidate" };
}

export function desktopBackendTarget(
	serverUrl: string
): "hono-bun" | "local-dev" {
	let url: URL;
	try {
		url = new URL(serverUrl);
	} catch {
		return "local-dev";
	}

	if (
		url.protocol === "file:" ||
		url.protocol === "postgres:" ||
		url.protocol === "postgresql:"
	) {
		return "local-dev";
	}

	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (
		host === "localhost" ||
		host === "127.0.0.1" ||
		host === "0.0.0.0" ||
		host === "::1"
	) {
		return "local-dev";
	}

	return "hono-bun";
}

export function productCandidateSigningReady(
	env: Record<string, string | undefined>
): { ready: true } | { ready: false; reason: string } {
	const signingIdentity = env.APPLE_SIGNING_IDENTITY?.trim();
	const signing =
		present(env.APPLE_CERTIFICATE) &&
		present(env.APPLE_CERTIFICATE_PASSWORD) &&
		present(signingIdentity) &&
		signingIdentity !== "-";
	if (!signing) {
		return { ready: false, reason: "missing-signing-credentials" };
	}

	const appleId =
		present(env.APPLE_ID) &&
		present(env.APPLE_PASSWORD) &&
		present(env.APPLE_TEAM_ID);
	const apiKey =
		present(env.APPLE_API_KEY) &&
		present(env.APPLE_API_ISSUER) &&
		present(env.APPLE_API_KEY_PATH);
	if (!(appleId || apiKey)) {
		return { ready: false, reason: "missing-notarization-credentials" };
	}

	return { ready: true };
}

export function shippingBundleTargets(
	targets: string | readonly string[]
): string[] {
	if (typeof targets === "string") {
		return [targets];
	}
	return [...targets];
}

function present(value: string | undefined): boolean {
	return Boolean(value?.trim());
}

function sameMajors(
	actual: readonly number[],
	expected: readonly number[]
): boolean {
	return (
		actual.length === expected.length &&
		actual.every((major, index) => major === expected[index])
	);
}
