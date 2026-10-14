import { describe, expect, it, vi } from "vitest";
import { safeOutboundBuffered } from "../src/platform/http/safe-outbound.ts";
import {
  executeSafeOutbound,
  type SafeOutboundAddress,
  type SafeOutboundDependencies,
  type SafeOutboundTransportResponse,
} from "../src/platform/http/safe-outbound-core.ts";

const PUBLIC_ADDRESS: SafeOutboundAddress = { address: "93.184.216.34", family: 4 };
const POLICY = {
  allowedHosts: ["hooks.example.test"],
  allowedContentTypes: ["application/json"],
  timeoutMs: 100,
  maxBytes: 16,
  maxRedirects: 2,
};

function response(
  status: number,
  headers: Record<string, string> = {},
  chunks: Uint8Array[] = [],
): SafeOutboundTransportResponse {
  return {
    status,
    headers,
    body: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
    abort: vi.fn(),
  };
}

function dependencies(overrides: Partial<SafeOutboundDependencies> = {}): SafeOutboundDependencies {
  return {
    resolve: vi.fn(async () => [PUBLIC_ADDRESS]),
    request: vi.fn(async () => response(200, { "content-type": "application/json" }, [new TextEncoder().encode("{}")])),
    ...overrides,
  };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("safe outbound SSRF contract", () => {
  it.each([
    "https://127.0.0.1/data",
    "https://10.0.0.1/data",
    "https://172.16.0.1/data",
    "https://192.168.1.1/data",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/data",
    "https://[fc00::1]/data",
    "https://[fe80::1]/data",
    "https://metadata.google.internal/computeMetadata/v1",
  ])("rejects a private, local or metadata literal: %s", async (url) => {
    await expectCode(executeSafeOutbound(url, { ...POLICY, allowedHosts: ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "::1", "fc00::1", "fe80::1", "metadata.google.internal"] }, dependencies()), "TARGET_DENIED");
  });

  it("rejects a client-supplied host outside the allowlist", async () => {
    await expectCode(executeSafeOutbound("https://evil.example/data", POLICY, dependencies()), "TARGET_DENIED");
  });

  it("rejects http and non-443 ports", async () => {
    await expectCode(executeSafeOutbound("http://hooks.example.test/data", POLICY, dependencies()), "PROTOCOL_DENIED");
    await expectCode(executeSafeOutbound("https://hooks.example.test:8443/data", POLICY, dependencies()), "PROTOCOL_DENIED");
  });

  it("rejects URL userinfo instead of SecretRef credentials", async () => {
    await expectCode(executeSafeOutbound("https://user:pass@hooks.example.test/data", POLICY, dependencies()), "INVALID_URL");
  });

  it("blocks hostnames that resolve to a private address", async () => {
    const deps = dependencies({ resolve: vi.fn(async () => [{ address: "192.168.10.20", family: 4 as const }]) });
    await expectCode(executeSafeOutbound("https://hooks.example.test/data", POLICY, deps), "TARGET_DENIED");
    expect(deps.request).not.toHaveBeenCalled();
  });

  it("rechecks DNS before dialing and rejects rebinding", async () => {
    const resolve = vi.fn()
      .mockResolvedValueOnce([PUBLIC_ADDRESS])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 as const }]);
    const deps = dependencies({ resolve });
    await expectCode(executeSafeOutbound("https://hooks.example.test/data", POLICY, deps), "TARGET_DENIED");
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(deps.request).not.toHaveBeenCalled();
  });

  it("revalidates a redirect and blocks a private destination", async () => {
    const deps = dependencies({
      request: vi.fn(async () => response(302, { location: "https://127.0.0.1/private" })),
    });
    await expectCode(executeSafeOutbound("https://hooks.example.test/data", POLICY, deps), "TARGET_DENIED");
  });

  it("rejects a redirect that leaves the allowlist", async () => {
    const deps = dependencies({
      request: vi.fn(async () => response(302, { location: "https://other.example/private" })),
    });
    await expectCode(executeSafeOutbound("https://hooks.example.test/data", POLICY, deps), "TARGET_DENIED");
  });

  it("rejects a declared content length above the byte limit", async () => {
    const deps = dependencies({
      request: vi.fn(async () => response(200, { "content-type": "application/json", "content-length": "17" })),
    });
    await expectCode(executeSafeOutbound("https://hooks.example.test/data", POLICY, deps), "RESPONSE_TOO_LARGE");
  });

  it("stops reading when the byte limit is exceeded", async () => {
    const deps = dependencies({
      request: vi.fn(async () => response(200, { "content-type": "application/json" }, [new Uint8Array(10), new Uint8Array(10)])),
    });
    await expectCode(executeSafeOutbound("https://hooks.example.test/data", POLICY, deps), "RESPONSE_TOO_LARGE");
  });

  it("enforces an end-to-end timeout for a slow response", async () => {
    const deps = dependencies({
      request: vi.fn(() => new Promise<SafeOutboundTransportResponse>(() => undefined)),
    });
    await expectCode(executeSafeOutbound("https://hooks.example.test/data", { ...POLICY, timeoutMs: 10 }, deps), "TIMEOUT");
  });

  it("returns a bounded body for allowlisted HTTPS through a mocked transport", async () => {
    const result = await executeSafeOutbound("https://hooks.example.test/hooks", POLICY, dependencies());
    expect(result.status).toBe(200);
    expect(new TextDecoder().decode(result.body)).toBe("{}");
    expect(result).not.toHaveProperty("finalUrl");
  });

  it("keeps the public adapter closed while outboundHttp is disabled", async () => {
    await expect(safeOutboundBuffered("https://hooks.example.test/hooks", POLICY)).rejects.toMatchObject({
      code: "OPTIONAL_MODULE_DISABLED",
    });
  });
});
