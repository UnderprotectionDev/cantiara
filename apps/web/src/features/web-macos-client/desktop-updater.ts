import { type KeyObject, verify } from "node:crypto";

export const desktopUpdatePolicy = {
	automaticRollback: false,
	previousSignedInstaller: "downloadable-manual-recovery",
} as const;

export interface InstalledDesktop {
	version: string;
}

export interface SignedDesktopUpdate {
	payload: Uint8Array;
	signature: Uint8Array;
	version: string;
}

export type DesktopUpdateResult =
	| { status: "applied"; version: string }
	| { previousIntact: true; status: "rejected"; version: string };

export interface SignedDesktopInstaller {
	downloadable: boolean;
	signed: boolean;
	url: string;
	version: string;
}

export type DesktopUpdateVerifier = (
	payload: Uint8Array,
	signature: Uint8Array,
	publicKey: KeyObject
) => boolean;

export function verifyDesktopUpdateSignature(
	payload: Uint8Array,
	signature: Uint8Array,
	publicKey: KeyObject
): boolean {
	return verify(null, payload, publicKey, signature);
}

export function applyVerifiedDesktopUpdate(
	installed: InstalledDesktop,
	candidate: SignedDesktopUpdate,
	publicKey: KeyObject,
	verifySignature: DesktopUpdateVerifier = verifyDesktopUpdateSignature
): DesktopUpdateResult {
	if (!verifySignature(candidate.payload, candidate.signature, publicKey)) {
		return {
			previousIntact: true,
			status: "rejected",
			version: installed.version,
		};
	}
	return { status: "applied", version: candidate.version };
}

export function manualRecoveryInstaller(
	catalog: readonly SignedDesktopInstaller[],
	currentVersion: string
): SignedDesktopInstaller | null {
	const currentIndex = catalog.findIndex(
		(release) => release.version === currentVersion
	);
	if (currentIndex <= 0) {
		return null;
	}
	for (let index = currentIndex - 1; index >= 0; index -= 1) {
		const release = catalog[index];
		if (release?.signed && release.downloadable) {
			return release;
		}
	}
	return null;
}

export function recoverFromFailedUpdate(
	installed: InstalledDesktop,
	catalog: readonly SignedDesktopInstaller[]
): {
	installedVersion: string;
	manualInstaller: SignedDesktopInstaller | null;
	rolledBack: false;
} {
	return {
		installedVersion: installed.version,
		manualInstaller: manualRecoveryInstaller(catalog, installed.version),
		rolledBack: false,
	};
}

export function visitorExternalSurface(): {
	desktopUpdater: false;
	updateRequired: false;
} {
	return { desktopUpdater: false, updateRequired: false };
}
