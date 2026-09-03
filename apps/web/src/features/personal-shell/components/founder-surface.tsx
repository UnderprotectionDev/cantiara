import { cn } from "@cantiara/ui/lib/utils";
import type { ReactNode } from "react";

export function FounderToolbar({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("mb-6 flex flex-wrap items-end gap-3", className)}>
			{children}
		</div>
	);
}

export function FounderSection({
	actions,
	children,
	className,
	title,
	titleId,
}: {
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	title: string;
	titleId?: string;
}) {
	return (
		<section
			aria-labelledby={titleId}
			className={cn("mb-8 min-w-0", className)}
		>
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 className="font-medium text-sm" id={titleId}>
					{title}
				</h2>
				{actions ? (
					<div className="flex shrink-0 items-center gap-2">{actions}</div>
				) : null}
			</div>
			{children}
		</section>
	);
}

export function FounderStack({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col divide-y border-y", className)}>
			{children}
		</div>
	);
}
