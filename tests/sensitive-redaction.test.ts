import { describe, expect, it } from "vitest";
import { createLogger } from "../src/platform/observability/logger.ts";
import { defineSecretRef, resolveSecretRef } from "../src/platform/security/secret-ref.ts";
import { sanitizeLogValue } from "../src/platform/security/sensitive-redaction.ts";
import { SensitiveValueRegistry } from "../src/platform/security/sensitive-values.ts";

function capture(run: (write: (chunk: string) => void) => void) {
  const lines: string[] = [];
  run((chunk) => lines.push(chunk));
  return lines.join("");
}

describe("bounded log redaction", () => {
  it("keeps operational code and correlation while hiding adversarial secrets", () => {
    const secret = "synthetic-adapter-secret-zzz-9911";
    resolveSecretRef(defineSecretRef("ADAPTER_CREDENTIAL"), { ADAPTER_CREDENTIAL: secret });
    const error = new Error(`login failed password=${secret}`);
    Object.assign(error, { code: "AUTH_INVALID" });
    (error as Error & { cause?: unknown }).cause = new Error("postgres://owner:hunter2@db.internal:5432/app");
    const payload = {
      code: "AUTH_INVALID",
      correlationId: "corr-trace-1",
      token: "header-token-should-vanish",
      nested: [{ otp: "847291", email: "member@fixture.test" }],
    };
    Object.defineProperty(payload, "getterSecret", { enumerable: true, get() { throw new Error(secret); } });
    const cycle: Record<string, unknown> = { code: "LOOP" };
    cycle.self = cycle;
    const output = capture((write) => {
      createLogger({ correlationId: "corr-trace-1" }, { write }).error({
        err: error,
        payload,
        cycle,
        remote: "https://hooks.example.test/ingest?token=abc",
      }, `Bearer ${secret}`);
    });
    expect(output).toContain("AUTH_INVALID");
    expect(output).toContain("corr-trace-1");
    expect(output).not.toContain(secret);
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("header-token-should-vanish");
    expect(output).not.toContain("847291");
    expect(output).not.toContain("member@fixture.test");
    expect(output).not.toContain("hooks.example.test");
    expect(output).toContain("[Circular]");
  });

  it("redacts printf interpolation values after formatting", () => {
    const output = capture((write) => {
      createLogger(undefined, { write }).info("password=%s", "hunter2");
    });
    expect(output).not.toContain("hunter2");
    expect(output).toContain("[REDACTED]");
  });

  it("fails closed when the resolved-secret registry is exhausted and does not drop earlier values", () => {
    const registry = new SensitiveValueRegistry(2, 64);
    registry.remember("kept-secret-one");
    registry.remember("kept-secret-two");
    expect(() => registry.remember("overflow-secret-three")).toThrow("SECRET_UNAVAILABLE");
    expect(registry.size).toBe(2);
    expect(sanitizeLogValue("prefix kept-secret-one kept-secret-two", registry)).toBe("prefix [REDACTED] [REDACTED]");
  });
});
