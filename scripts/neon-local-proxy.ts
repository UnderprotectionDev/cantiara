import { connect, type Socket, serve } from "bun";

interface ProxyData {
  pending: Uint8Array[];
  socket?: Socket;
}

const listenHost = process.env.NEON_LOCAL_PROXY_HOST ?? "127.0.0.1";
const listenPort = Number(process.env.NEON_LOCAL_PROXY_PORT ?? "5433");
const postgresHost = process.env.NEON_LOCAL_POSTGRES_HOST ?? "127.0.0.1";
const postgresPort = Number(process.env.NEON_LOCAL_POSTGRES_PORT ?? "5432");

serve<ProxyData>({
  fetch(request, server) {
    const requestedProtocol = request.headers
      .get("sec-websocket-protocol")
      ?.split(",", 1)[0]
      ?.trim();
    if (
      server.upgrade(request, {
        data: { pending: [] },
        headers: requestedProtocol
          ? { "Sec-WebSocket-Protocol": requestedProtocol }
          : undefined,
      })
    ) {
      return;
    }
    return new Response("WebSocket upgrade required", { status: 426 });
  },
  hostname: listenHost,
  port: listenPort,
  websocket: {
    close(websocket) {
      websocket.data.socket?.end();
    },
    async open(websocket) {
      try {
        const socket = await connect({
          hostname: postgresHost,
          port: postgresPort,
          socket: {
            close() {
              websocket.close();
            },
            data(_socket, data) {
              websocket.send(data);
            },
            error(_socket, error) {
              console.error(error);
              websocket.close(1011, "PostgreSQL connection failed");
            },
            open() {
              // Data queued during the TCP handshake is flushed below.
            },
          },
        });
        websocket.data.socket = socket;
        for (const data of websocket.data.pending) {
          socket.write(data);
        }
        websocket.data.pending = [];
      } catch (error) {
        console.error(error);
        websocket.close(1011, "PostgreSQL connection failed");
      }
    },
    message(websocket, message) {
      const data =
        typeof message === "string"
          ? new TextEncoder().encode(message)
          : new Uint8Array(message);
      if (websocket.data.socket) {
        websocket.data.socket.write(data);
      } else {
        websocket.data.pending.push(data);
      }
    },
  },
});
