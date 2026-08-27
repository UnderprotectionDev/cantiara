import { cn } from "@cantiara/ui/lib/utils";
import type { ReactNode } from "react";

export function FounderPage({
	actions,
	children,
	title,
	wide,
}: {
	actions?: ReactNode;
	children: ReactNode;
	title: string;
	wide?: boolean;
}) {
	return (
		<main
			className={cn(
				"mx-auto w-full px-6 py-12",
				wide ? "max-w-5xl" : "max-w-[40rem]"
			)}
		>
			<div className="mb-8 flex items-center justify-between gap-4">
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
