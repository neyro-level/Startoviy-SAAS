import "server-only";

import { lookup } from "node:dns/promises";
import { request as requestHttps } from "node:https";
import { isIP } from "node:net";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { requireOptionalModule } from "../config/optional-modules.ts";
import { optionalModules } from "../config/project-identity.ts";
import {
  executeSafeOutbound,
  executeSafeOutboundStream,
  SafeOutboundError,
  type SafeOutboundDependencies,
  type SafeOutboundPolicy,
  type SafeOutboundResult,
  type SafeOutboundStreamResult,
  type SafeOutboundTransportResponse,
} from "./safe-outbound-core.ts";

export { SafeOutboundError } from "./safe-outbound-core.ts";
export type { SafeOutboundPolicy, SafeOutboundResult, SafeOutboundStreamResult } from "./safe-outbound-core.ts";

function firstHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function toTransportResponse(message: IncomingMessage): SafeOutboundTransportResponse {
  return {
    status: message.statusCode ?? 0,
    headers: {
      location: firstHeader(message.headers, "location"),
      "content-type": firstHeader(message.headers, "content-type"),
      "content-length": firstHeader(message.headers, "content-length"),
    },
    body: message,
    abort: () => message.destroy(),
  };
}

const dependencies: SafeOutboundDependencies = {
  async resolve(hostname) {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
  },
  request(input) {
    return new Promise((resolve, reject) => {
      const hostname = input.url.hostname.replace(/^\[|\]$/g, "");
      const req = requestHttps({
        protocol: "https:",
        hostname: input.address.address,
        family: input.address.family,
        port: 443,
        path: `${input.url.pathname}${input.url.search}`,
        method: "GET",
        servername: isIP(hostname) === 0 ? hostname : undefined,
        headers: {
          host: input.url.host,
          accept: input.accept,
          "user-agent": "AMS-Start-Safe-Outbound/1.0",
          connection: "close",
          ...(input.authorization ? { authorization: input.authorization } : {}),
        },
      }, (message) => resolve(toTransportResponse(message)));
      const abort = () => req.destroy(new SafeOutboundError("TIMEOUT", "Outbound request timed out"));
      input.signal.addEventListener("abort", abort, { once: true });
      req.once("error", reject);
      req.once("close", () => input.signal.removeEventListener("abort", abort));
      req.end();
    });
  },
};

export async function safeOutboundBuffered(
  input: string | URL,
  policy: SafeOutboundPolicy,
): Promise<SafeOutboundResult> {
  requireOptionalModule(optionalModules, "outboundHttp");
  return executeSafeOutbound(input, policy, dependencies);
}

export async function safeOutboundStream(
  input: string | URL,
  policy: SafeOutboundPolicy,
): Promise<SafeOutboundStreamResult> {
  requireOptionalModule(optionalModules, "outboundHttp");
  return executeSafeOutboundStream(input, policy, dependencies);
}
