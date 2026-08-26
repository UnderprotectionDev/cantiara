import type { ReactNode } from "react";

import type { VisitorPaletteSurface } from "../command-palette";
import { PaletteSurfaceProvider } from "./founder-command-palette";

export function VisitorDocument({
	children,
	surface,
}: {
	children?: ReactNode;
	surface: VisitorPaletteSurface;
}) {
	return (
		<PaletteSurfaceProvider surface={surface}>
			<article>{children}</article>
		</PaletteSurfaceProvider>
	);
}
