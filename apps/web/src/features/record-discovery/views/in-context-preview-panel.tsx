import { Button } from "@cantiara/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@cantiara/ui/components/sheet";
import { useQuery } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

import { orpc } from "@/utils/orpc";

import {
	closeSourceRecordPreview,
	type InContextPreviewSurface,
	openFullPage,
	openSourceRecordPreview,
	type PreviewListPlace,
	type PreviewSession,
} from "./in-context-preview";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

interface OpenPreviewInput {
	listPlace: PreviewListPlace;
	recordId: string;
	sourceHref: string;
	surface: InContextPreviewSurface;
}

interface InContextPreviewApi {
	close: () => void;
	open: (input: OpenPreviewInput) => void;
	session: PreviewSession | null;
}

const InContextPreviewContext = createContext<InContextPreviewApi | null>(null);

export function InContextPreviewProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [session, setSession] = useState<PreviewSession | null>(null);
	const open = useCallback((input: OpenPreviewInput) => {
		setSession((current) => openSourceRecordPreview(current, input).session);
	}, []);
	const close = useCallback(() => {
		setSession((current) => closeSourceRecordPreview(current).session);
	}, []);
	const value = useMemo(
		() => ({ close, open, session }),
		[close, open, session]
	);
	return (
		<InContextPreviewContext.Provider value={value}>
			{children}
			<InContextPreviewPanel onClose={close} session={session} />
		</InContextPreviewContext.Provider>
	);
}

export function useInContextPreview(): InContextPreviewApi {
	const api = useContext(InContextPreviewContext);
	if (!api) {
		throw new Error("InContextPreviewProvider is required");
	}
	return api;
}

function InContextPreviewPanel({
	onClose,
	session,
}: {
	onClose: () => void;
	session: PreviewSession | null;
}) {
	const work = useQuery({
		...orpc.workLifecycle.get.queryOptions({
			input: { workId: session?.recordId ?? "" },
		}),
		enabled: Boolean(session?.recordId),
	});
	const onOpenChange = useCallback(
		(next: boolean) => {
			if (!next) {
				onClose();
			}
		},
		[onClose]
	);
	const onOpenFullPage = useCallback(() => {
		onClose();
	}, [onClose]);
	const title = work.data
		? `${work.data.key} ${work.data.title}`
		: RECORD_DISCOVERY_COPY.openSourceRecord;
	const fullPage = openFullPage(session);

	return (
		<Sheet onOpenChange={onOpenChange} open={session !== null}>
			<SheetContent className="sm:max-w-lg" side="right">
				<SheetHeader>
					<SheetTitle>{title}</SheetTitle>
					<SheetDescription>
						{RECORD_DISCOVERY_COPY.openSourceRecord}
					</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col gap-3 px-4 pb-4">
					{work.isError ? (
						<p role="alert">{RECORD_DISCOVERY_COPY.unavailable}</p>
					) : null}
					{work.data ? (
						<p className="text-sm">
							<span className="font-mono text-muted-foreground text-xs">
								{work.data.key}
							</span>{" "}
							{work.data.title}
							<span className="mt-1 block text-muted-foreground">
								{work.data.status}
							</span>
						</p>
					) : null}
					{fullPage.href ? (
						<Button
							onClick={onOpenFullPage}
							render={<a href={fullPage.href} />}
							size="sm"
							variant="outline"
						>
							{RECORD_DISCOVERY_COPY.openFullPage}
						</Button>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	);
}
