import { cn } from "@cantiara/ui/lib/utils";
import type { ReactNode } from "react";

import { FOUNDER_MAIN_ID } from "./founder-chrome";

export function FounderPage({
	actions,
	children,
	className,
	title,
	wide,
}: {
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	title: string;
	wide?: boolean;
}) {
	return (
		<main
			className={cn(
				"mx-auto w-full px-6 py-8",
				wide ? "max-w-5xl" : "max-w-[40rem]",
				className
			)}
			id={FOUNDER_MAIN_ID}
		>
			<div className="mb-6 flex items-center justify-between gap-4">
				<h1 className="font-semibold text-[1.375rem] tracking-tight">
					{title}
				</h1>
				{actions ? (
					<div className="flex shrink-0 items-center gap-2">{actions}</div>
				) : null}
			</div>
			{children}
		</main>
	);
}
