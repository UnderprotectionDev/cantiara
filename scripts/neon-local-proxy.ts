/**
 * Neon local WebSocket proxy for development.
 *
 * The Neon serverless driver (`@neondatabase/serverless`, used by
 * `@prisma/adapter-neon`) speaks the Postgres wire protocol over a WebSocket
 * instead of raw TCP. In production it connects to Neon's cloud endpoint; for
 * local development we tunnel those WebSocket frames straight to a local
 * Postgres server, so no Neon account or cloud database is required.
 *
 * Pair this with the local `neonConfig` overrides in `packages/db/src/index.ts`
 * (enabled by `NEON_LOCAL=true`). Run with: `bun run scripts/neon-local-proxy.ts`.
 */

import type { Socket } from "bun";

const { Bun } = globalThis;

const LISTEN_HOST = process.env.NEON_LOCAL_PROXY_HOST ?? "127.0.0.1";
const LISTEN_PORT = Number(process.env.NEON_LOCAL_PROXY_PORT ?? 5433);
const PG_HOST = process.env.NEON_LOCAL_PG_HOST ?? "127.0.0.1";
const PG_PORT = Number(process.env.NEON_LOCAL_PG_PORT ?? 5432);

type Chunk = Uint8Array;

interface SocketData {
	buffered: Chunk[];
	closed: boolean;
	tcp: Socket | null;
}

const toBytes = (message: string | Buffer | Uint8Array): Chunk =>
	typeof message === "string" ? new TextEncoder().encode(message) : message;

const server = Bun.serve<SocketData, undefined>({
	fetch(req, srv) {
		if (
			srv.upgrade(req, { data: { buffered: [], closed: false, tcp: null } })
		) {
			return;
		}
		return new Response("neon local ws proxy is running\n");
	},
	hostname: LISTEN_HOST,
	port: LISTEN_PORT,
	websocket: {
		close(ws) {
			ws.data.closed = true;
			ws.data.tcp?.end();
		},
		message(ws, message) {
			const bytes = toBytes(message);
			if (ws.data.tcp) {
				ws.data.tcp.write(bytes);
			} else {
				ws.data.buffered.push(bytes);
			}
		},
		async open(ws) {
			try {
				const tcp = await Bun.connect({
					hostname: PG_HOST,
					port: PG_PORT,
					socket: {
						close() {
							if (!ws.data.closed) {
								ws.data.closed = true;
								ws.close();
							}
						},
						data(_sock, data) {
							ws.send(data);
						},
						error(_sock, err) {
							console.error("[neon-proxy] postgres socket error:", err.message);
							if (!ws.data.closed) {
								ws.data.closed = true;
								ws.close();
							}
						},
					},
				});

				ws.data.tcp = tcp;
				for (const chunk of ws.data.buffered) {
					tcp.write(chunk);
				}
				ws.data.buffered = [];
			} catch (err) {
				console.error(
					"[neon-proxy] failed to connect to postgres:",
					err instanceof Error ? err.message : err
				);
				ws.close();
			}
		},
	},
});

console.log(
	`[neon-proxy] WebSocket proxy listening on ws://${server.hostname}:${server.port} -> tcp://${PG_HOST}:${PG_PORT}`
);
