"use client";

import { cn } from "@cantiara/ui/lib/utils";
import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({
	className,
	style,
	toastOptions,
	...props
}: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			{...props}
			className={cn("toaster group", className)}
			expand
			icons={{
				error: <OctagonXIcon className="size-4 text-destructive" />,
				info: <InfoIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
				success: <CircleCheckIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
			}}
			style={
				{
					"--border-radius": "0px",
					"--error-bg": "var(--popover)",
					"--error-border": "var(--border)",
					"--error-text": "var(--popover-foreground)",
					"--info-bg": "var(--popover)",
					"--info-border": "var(--border)",
					"--info-text": "var(--popover-foreground)",
					"--normal-bg": "var(--popover)",
					"--normal-border": "var(--border)",
					"--normal-text": "var(--popover-foreground)",
					"--success-bg": "var(--popover)",
					"--success-border": "var(--border)",
					"--success-text": "var(--popover-foreground)",
					"--warning-bg": "var(--popover)",
					"--warning-border": "var(--border)",
					"--warning-text": "var(--popover-foreground)",
					...style,
				} as React.CSSProperties
			}
			theme={theme as ToasterProps["theme"]}
			toastOptions={{
				...toastOptions,
				classNames: {
					actionButton:
						"!h-7 !rounded-none !border !border-border !bg-background !px-2.5 !font-medium !text-foreground !text-xs !shadow-none",
					closeButton: "!border-border !bg-background !text-muted-foreground",
					description: "!text-muted-foreground !text-xs !leading-snug",
					icon: "!mt-0.5 !self-start",
					title: "!font-medium !text-foreground !text-sm",
					toast:
						"cn-toast !items-start !gap-3 !rounded-none !border-border !p-3.5 !shadow-lg",
					...toastOptions?.classNames,
				},
			}}
		/>
	);
};

export { Toaster };
