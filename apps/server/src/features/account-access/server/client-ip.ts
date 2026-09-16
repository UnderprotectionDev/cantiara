import type { Context as HonoContext } from "hono";
import ipaddr from "ipaddr.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIp(value: string) {
  try {
    return ipaddr.parse(value);
  } catch {
    return null;
  }
}

function isTrustedProxy(address: string, trustedProxyIps: readonly string[]) {
  const parsedAddress = parseIp(address);
  if (!parsedAddress) {
    return false;
  }

  return trustedProxyIps.some((trustedProxyIp) => {
    const exactAddress = parseIp(trustedProxyIp);
    if (exactAddress) {
      return (
        parsedAddress.kind() === exactAddress.kind() &&
        parsedAddress.toString() === exactAddress.toString()
      );
    }

    try {
      const [network, prefixLength] = ipaddr.parseCIDR(trustedProxyIp);
      if (parsedAddress.kind() !== network.kind()) {
        return false;
      }

      if (parsedAddress.kind() === "ipv4") {
        return (parsedAddress as ipaddr.IPv4).match(
          network as ipaddr.IPv4,
          prefixLength,
        );
      }

      return (parsedAddress as ipaddr.IPv6).match(
        network as ipaddr.IPv6,
        prefixLength,
      );
    } catch {
      return false;
    }
  });
}

function normalizeIp(value: string) {
  return parseIp(value)?.toString() ?? null;
}

function connectionAddress(context: HonoContext, request: Request) {
  const environment: unknown = context.env;
  if (!isRecord(environment)) {
    return;
  }

  const server = "server" in environment ? environment.server : environment;
  if (!isRecord(server) || typeof server.requestIP !== "function") {
    return;
  }

  try {
    const connection = server.requestIP(request) as unknown;
    return isRecord(connection) && typeof connection.address === "string"
      ? connection.address
      : undefined;
  } catch {
    // Bun's connection metadata is optional outside the Bun server adapter.
  }
}

function forwardedClientIp(value: string, trustedProxyIps: readonly string[]) {
  const forwardedIps = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (
    forwardedIps.length === 0 ||
    forwardedIps.some((entry) => !parseIp(entry))
  ) {
    return null;
  }

  if (trustedProxyIps.length === 0) {
    return forwardedIps.length === 1
      ? normalizeIp(forwardedIps[0] ?? "")
      : null;
  }

  for (let index = forwardedIps.length - 1; index >= 0; index -= 1) {
    const forwardedIp = forwardedIps[index];
    if (forwardedIp && isTrustedProxy(forwardedIp, trustedProxyIps)) {
      continue;
    }
    return forwardedIp ? normalizeIp(forwardedIp) : null;
  }
  return null;
}

export function requestClientIp(
  request: Request,
  context: HonoContext,
  trustedProxyIps: readonly string[],
) {
  const remoteAddress = connectionAddress(context, request);

  if (!remoteAddress) {
    return "unknown";
  }

  if (isTrustedProxy(remoteAddress, trustedProxyIps)) {
    const forwarded = request.headers.get("x-forwarded-for");
    const forwardedIp = forwarded
      ? forwardedClientIp(forwarded, trustedProxyIps)
      : null;
    if (forwardedIp) {
      return forwardedIp;
    }
  }

  return normalizeIp(remoteAddress) ?? "unknown";
}
