import { describe, expect, it } from "vitest";
import { liveHealthSchema, readyHealthSchema } from "../src/platform/http/health.ts";
import { projectIdentity } from "../src/platform/config/project-identity.ts";

const releaseSha = "a".repeat(40);
const correlationId = "00000000-0000-4000-8000-000000000000";

describe("health contracts", () => {
  it("accepts neutral live service id", () => {
    expect(
      liveHealthSchema.parse({
        status: "ok",
        service: projectIdentity.identity.serviceId,
        releaseSha,
        correlationId,
        time: new Date().toISOString(),
      }).service,
    ).toBe(projectIdentity.identity.serviceId);
  });

  it("does not require provider freshness in readiness", () => {
    expect(
      readyHealthSchema.parse({
        status: "ready",
        service: projectIdentity.identity.serviceId,
        releaseSha: null,
        correlationId,
        dependencies: {
          postgresql: "ready",
          auth: "configured",
          outbox: { status: "healthy", pending: 0, processing: 0, deadLetter: 0 },
          worker: { status: "unknown", lastHeartbeatAt: null },
        },
      }).dependencies.outbox.status,
    ).toBe("healthy");
  });
});
