import { unsavedAccountPreferences } from "@cantiara/auth/account-preferences-model";
import { useQuery } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

import {
	attemptOnlineWork as attemptShellWork,
	type ClientShell,
	clearClientShellUnsaved,
	createClientShell,
	detectClientShellHost,
	markClientShellUnsaved,
	type OnlineWorkKind,
	type OnlineWorkResult,
	offlineEmptyState,
	readNavigatorOnline,
	recordClientShellSave,
	setClientShellConnection,
	setClientShellDesktopApi,
	updateRequiredState,
} from "./client-shell";
import { OfflineEmptyState } from "./offline-empty-state";
import { UpdateRequiredState } from "./update-required-state";

interface ClientShellContextValue {
	attemptOnlineWork: <T>(
		kind: OnlineWorkKind,
		work: () => T
	) => OnlineWorkResult<T>;
	clearUnsaved: () => void;
	markUnsaved: () => void;
	recordSave: (instant?: Date) => void;
	shell: ClientShell;
}

const ClientShellContext = createContext<ClientShellContextValue | null>(null);

export function ClientShellProvider({ children }: { children: ReactNode }) {
	const [shell, setShell] = useState(() =>
		createClientShell({
			connected: readNavigatorOnline(),
			host: detectClientShellHost(),
		})
	);

	useEffect(() => {
		const goOnline = () => {
			setShell((current) => setClientShellConnection(current, true));
		};
		const goOffline = () => {
			setShell((current) => setClientShellConnection(current, false));
		};
		window.addEventListener("online", goOnline);
		window.addEventListener("offline", goOffline);
		setShell((current) =>
			setClientShellConnection(current, readNavigatorOnline())
		);
		return () => {
			window.removeEventListener("online", goOnline);
			window.removeEventListener("offline", goOffline);
		};
	}, []);

	const desktopApiWindow = useQuery({
		...orpc.clientShell.desktopApiWindow.queryOptions(),
		enabled: shell.host === "tauri" && shell.connected,
	});

	useEffect(() => {
		const status = desktopApiWindow.data?.status;
		if (status === "accepted" || status === "update-required") {
			setShell((current) => setClientShellDesktopApi(current, status));
		}
	}, [desktopApiWindow.data?.status]);

	const attemptOnlineWork = useCallback(
		<T,>(kind: OnlineWorkKind, work: () => T) =>
			attemptShellWork(shell, kind, work),
		[shell]
	);
	const markUnsaved = useCallback(() => {
		setShell((current) => markClientShellUnsaved(current));
	}, []);
	const clearUnsaved = useCallback(() => {
		setShell((current) => clearClientShellUnsaved(current));
	}, []);
	const recordSave = useCallback((instant = new Date()) => {
		setShell((current) => recordClientShellSave(current, instant));
	}, []);

	const value = useMemo(
		() => ({
			attemptOnlineWork,
			clearUnsaved,
			markUnsaved,
			recordSave,
			shell,
		}),
		[attemptOnlineWork, clearUnsaved, markUnsaved, recordSave, shell]
	);

	return (
		<ClientShellContext.Provider value={value}>
			{children}
		</ClientShellContext.Provider>
	);
}

export function ClientShellWorkspace({ children }: { children: ReactNode }) {
	const { shell } = useClientShell();
	const { data: session } = authClient.useSession();
	const preferences = useQuery({
		...orpc.accountPreferences.get.queryOptions(),
		enabled: Boolean(session?.user),
	});
	const [formatPreferences, setFormatPreferences] = useState(
		unsavedAccountPreferences
	);

	useEffect(() => {
		if (preferences.data) {
			setFormatPreferences(preferences.data);
		}
	}, [preferences.data]);

	const empty = offlineEmptyState(shell, formatPreferences);
	const updateRequired = updateRequiredState(shell);

	if (empty) {
		return <OfflineEmptyState state={empty} />;
	}
	if (updateRequired) {
		return <UpdateRequiredState state={updateRequired} />;
	}
	return children;
}

export function useClientShell() {
	const value = useContext(ClientShellContext);
	if (!value) {
		throw new Error("ClientShellProvider is required");
	}
	return value;
}
