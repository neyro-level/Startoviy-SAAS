import "server-only";

import { BlockList, isIP } from "node:net";
import type { SecretRef } from "../security/secret-ref.ts";
import { resolveSecretRef } from "../security/secret-ref.ts";

export interface SafeOutboundPolicy {
  allowedHosts: readonly string[];
  allowedContentTypes: readonly string[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
  authorization?: SecretRef;
}

export interface SafeOutboundAddress {
  address: string;
  family: 4 | 6;
}

export interface SafeOutboundTransportResponse {
  status: number;
  headers: Readonly<Record<string, string | undefined>>;
  body: AsyncIterable<Uint8Array>;
  abort(): void;
}

export interface SafeOutboundTransportRequest {
  url: URL;
  address: SafeOutboundAddress;
  accept: string;
  signal: AbortSignal;
  authorization?: string;
}

export interface SafeOutboundDependencies {
  resolve(hostname: string): Promise<readonly SafeOutboundAddress[]>;
  request(input: SafeOutboundTransportRequest): Promise<SafeOutboundTransportResponse>;
}

export interface SafeOutboundResult {
  status: number;
  contentType: string;
  body: Uint8Array;
}

export type SafeOutboundErrorCode =
  | "INVALID_URL"
  | "PROTOCOL_DENIED"
  | "TARGET_DENIED"
  | "DNS_FAILED"
  | "REDIRECT_DENIED"
  | "TOO_MANY_REDIRECTS"
  | "TIMEOUT"
  | "RESPONSE_TOO_LARGE"
  | "RESPONSE_TRUNCATED"
  | "CONTENT_TYPE_DENIED"
  | "HTTP_STATUS_DENIED";

export class SafeOutboundError extends Error {
  constructor(
    public readonly code: SafeOutboundErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SafeOutboundError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
const METADATA_HOSTS = new Set(["metadata.google.internal", "metadata.internal"]);

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["100::", 64], ["2001:2::", 48], ["2001:db8::", 32],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv6");

function boundedInteger(value: number | undefined, fallback: number, maximum: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0 || resolved > maximum) {
    throw new SafeOutboundError("INVALID_URL", `${label} is outside the approved outbound limit`);
  }
  return resolved;
}

function normalizeHostname(hostname: string): string {
  const withoutBrackets = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  return withoutBrackets.replace(/\.$/, "").toLowerCase();
}

function parseUrl(input: string | URL, base?: URL): URL {
  try {
    return new URL(input.toString(), base);
  } catch {
    throw new SafeOutboundError("INVALID_URL", "Outbound URL is invalid");
  }
}

function assertHttpsTarget(url: URL, allowedHosts: ReadonlySet<string>): void {
  if (url.protocol !== "https:") {
    throw new SafeOutboundError("PROTOCOL_DENIED", "Outbound URL protocol is not allowed");
  }
  if (url.port && url.port !== "443") {
    throw new SafeOutboundError("PROTOCOL_DENIED", "Outbound URL port is not allowed");
  }
  if (url.username || url.password) {
    throw new SafeOutboundError("INVALID_URL", "Outbound URL credentials are forbidden");
  }
  const hostname = normalizeHostname(url.hostname);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || METADATA_HOSTS.has(hostname)) {
    throw new SafeOutboundError("TARGET_DENIED", "Local outbound targets are forbidden");
  }
  if (!allowedHosts.has(hostname)) {
    throw new SafeOutboundError("TARGET_DENIED", "Outbound host is not allowlisted");
  }
}

function assertAddress(address: SafeOutboundAddress): void {
  const detectedFamily = isIP(address.address);
  if (detectedFamily !== address.family) {
    throw new SafeOutboundError("DNS_FAILED", "DNS returned an invalid address family");
  }
  const mappedMatch = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address.address);
  const mappedIpv4 = mappedMatch
    ? [
      Number.parseInt(mappedMatch[1]!, 16) >> 8,
      Number.parseInt(mappedMatch[1]!, 16) & 255,
      Number.parseInt(mappedMatch[2]!, 16) >> 8,
      Number.parseInt(mappedMatch[2]!, 16) & 255,
    ].join(".")
    : /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address.address)?.[1];
  const denied = mappedIpv4
    ? blockedAddresses.check(mappedIpv4, "ipv4")
    : blockedAddresses.check(address.address, address.family === 4 ? "ipv4" : "ipv6");
  if (denied) {
    throw new SafeOutboundError("TARGET_DENIED", "Outbound target resolves to a non-public address");
  }
}

async function resolveAndValidate(
  url: URL,
  dependencies: SafeOutboundDependencies,
): Promise<readonly SafeOutboundAddress[]> {
  const hostname = normalizeHostname(url.hostname);
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await dependencies.resolve(hostname).catch(() => {
      throw new SafeOutboundError("DNS_FAILED", "Outbound target DNS resolution failed");
    });
  if (addresses.length === 0) {
    throw new SafeOutboundError("DNS_FAILED", "Outbound target has no resolved addresses");
  }
  for (const address of addresses) assertAddress(address);
  return addresses;
}

function matchesContentType(actual: string, allowed: readonly string[]): boolean {
  const normalized = actual.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return allowed.some((candidate) => {
    const expected = candidate.trim().toLowerCase();
    return expected.endsWith("/*")
      ? normalized.startsWith(expected.slice(0, -1))
      : normalized === expected;
  });
}

async function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new SafeOutboundError("TIMEOUT", "Outbound request timed out"));
      return;
    }
    const abort = () => reject(new SafeOutboundError("TIMEOUT", "Outbound request timed out"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

export async function executeSafeOutbound(
  input: string | URL,
  policy: SafeOutboundPolicy,
  dependencies: SafeOutboundDependencies,
): Promise<SafeOutboundResult> {
  if (policy.allowedHosts.length === 0 || policy.allowedContentTypes.length === 0) {
    throw new SafeOutboundError("TARGET_DENIED", "Outbound allowlist is required");
  }
  const allowedHosts = new Set(policy.allowedHosts.map((host) => normalizeHostname(host)));
  const timeoutMs = boundedInteger(policy.timeoutMs, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, "timeoutMs");
  const maxBytes = boundedInteger(policy.maxBytes, DEFAULT_MAX_BYTES, MAX_RESPONSE_BYTES, "maxBytes");
  const maxRedirects = boundedInteger(
    (policy.maxRedirects ?? DEFAULT_MAX_REDIRECTS) + 1,
    DEFAULT_MAX_REDIRECTS + 1,
    11,
    "maxRedirects",
  ) - 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: SafeOutboundTransportResponse | undefined;
  const abortResponse = () => response?.abort();
  controller.signal.addEventListener("abort", abortResponse, { once: true });
  const cancel = () => controller.abort();
  policy.signal?.addEventListener("abort", cancel, { once: true });
  if (policy.signal?.aborted) cancel();

  const close = () => {
    clearTimeout(timeout);
    controller.abort();
    controller.signal.removeEventListener("abort", abortResponse);
    policy.signal?.removeEventListener("abort", cancel);
  };

  try {
    let currentUrl = parseUrl(input);
    for (let redirectCount = 0; ; redirectCount += 1) {
      assertHttpsTarget(currentUrl, allowedHosts);
      await raceAbort(resolveAndValidate(currentUrl, dependencies), controller.signal);
      const connectionAddresses = await raceAbort(resolveAndValidate(currentUrl, dependencies), controller.signal);
      const authorization = policy.authorization
        ? resolveSecretRef(policy.authorization)
        : undefined;
      const transport = await raceAbort(dependencies.request({
        url: currentUrl,
        address: connectionAddresses[0]!,
        accept: policy.allowedContentTypes.join(", "),
        signal: controller.signal,
        authorization,
      }).then((received) => {
        if (controller.signal.aborted) {
          received.abort();
          throw new SafeOutboundError("TIMEOUT", "Outbound request timed out");
        }
        return received;
      }), controller.signal);
      response = transport;

      if ([301, 302, 303, 307, 308].includes(transport.status)) {
        transport.abort();
        const location = transport.headers.location;
        if (!location) throw new SafeOutboundError("REDIRECT_DENIED", "Outbound redirect has no Location header");
        if (redirectCount >= maxRedirects) {
          throw new SafeOutboundError("TOO_MANY_REDIRECTS", "Outbound redirect limit exceeded");
        }
        currentUrl = parseUrl(location, currentUrl);
        response = undefined;
        continue;
      }
      if (transport.status < 200 || transport.status >= 300) {
        throw new SafeOutboundError("HTTP_STATUS_DENIED", `Outbound response status ${transport.status} is not accepted`);
      }
      const contentType = transport.headers["content-type"] ?? "";
      if (!matchesContentType(contentType, policy.allowedContentTypes)) {
        throw new SafeOutboundError("CONTENT_TYPE_DENIED", "Outbound response content type is not allowed");
      }
      const contentLength = transport.headers["content-length"];
      if (contentLength !== undefined && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) {
        throw new SafeOutboundError("RESPONSE_TOO_LARGE", "Outbound response exceeds the byte limit");
      }
      const expectedBytes = contentLength === undefined ? null : Number(contentLength);
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      const iterator = transport.body[Symbol.asyncIterator]();
      try {
        while (true) {
          if (controller.signal.aborted) {
            throw new SafeOutboundError("TIMEOUT", "Outbound request timed out or was closed");
          }
          const next = await raceAbort(iterator.next(), controller.signal);
          if (next.done) break;
          receivedBytes += next.value.byteLength;
          if (receivedBytes > maxBytes) {
            throw new SafeOutboundError("RESPONSE_TOO_LARGE", "Outbound response exceeds the byte limit");
          }
          chunks.push(next.value);
        }
        if (expectedBytes !== null && receivedBytes !== expectedBytes) {
          throw new SafeOutboundError("RESPONSE_TRUNCATED", "Outbound body length differs from its declaration");
        }
      } finally {
        void iterator.return?.().catch(() => undefined);
      }
      const body = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { status: transport.status, contentType, body };
    }
  } finally {
    close();
  }
}
