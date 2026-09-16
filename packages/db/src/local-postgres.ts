import { neonConfig } from "@neondatabase/serverless";

if (process.env.NEON_LOCAL === "true") {
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
  neonConfig.wsProxy = () => process.env.NEON_LOCAL_PROXY ?? "127.0.0.1:5433";
}
