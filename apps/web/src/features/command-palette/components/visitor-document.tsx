import type { ReactNode } from "react";

import {
	type VisitorPaletteSurface,
	visitorDocumentChrome,
} from "../command-palette";
import { PaletteSurfaceProvider } from "./founder-command-palette";

export function VisitorDocument({
	children,
	surface,
}: {
	children?: ReactNode;
	surface: VisitorPaletteSurface;
}) {
	const chrome = visitorDocumentChrome(surface);
	return (
		<PaletteSurfaceProvider surface={chrome.surface}>
			<article>{children}</article>
		</PaletteSurfaceProvider>
	);
}
