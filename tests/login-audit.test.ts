import { describe, expect, it } from "vitest";
import { loginAuditActions, toLoginAuditMarker } from "../src/platform/auth/login-audit.ts";
import { createLogger } from "../src/platform/observability/logger.ts";
import { Prisma } from "../src/generated/prisma/client.ts";

describe("login audit markers", () => {
  it("keeps only boolean operational flags and drops secrets", () => {
    const marker = toLoginAuditMarker({
      locked: true,
      sessionsRevoked: true,
      password: "hunter2",
      otp: "847291",
      token: "secret-token",
      ip: "192.0.2.11",
    });
    expect(marker).toEqual({ locked: true, sessionsRevoked: true });
    expect(JSON.stringify(marker)).not.toMatch(/hunter2|847291|secret-token|192\.0\.2\.11/);
  });

  it("exports the bounded login event names without secret-bearing labels", () => {
    expect([...loginAuditActions]).toEqual([
      "login.failed",
      "login.password-verified",
      "login.locked",
      "login.unlocked",
      "login.mfa",
      "login.recovery",
      "login.session-revoke",
    ]);
    expect(toLoginAuditMarker(null)).toBe(Prisma.JsonNull);
  });

  it("redacts interpolated OTP from login log fixtures", () => {
    const lines: string[] = [];
    createLogger(undefined, { write: (chunk) => lines.push(chunk) }).info(
      "login.failed otp=%s token=%s",
      "847291",
      "recovery-token-value",
    );
    const output = lines.join("");
    expect(output).not.toContain("847291");
    expect(output).not.toContain("recovery-token-value");
  });
});
