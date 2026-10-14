import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isClientAccessEnabled, readAuthEnvironment } from "../src/platform/config/server-environment.ts";
import {
  authPasswordPolicy,
  betterAuthPinnedVersion,
  createAuthIpAddressConfig,
  createEmailPasswordConfig,
  isTotpVerificationPath,
} from "../src/platform/auth/security-config.ts";
import {
  completeAccountSetupInputSchema,
  completePlatformRecoveryInputSchema,
  resetUserPasswordInputSchema,
} from "../src/modules/identity-access/domain/admin-identity.ts";

const authEnvironment = {
  BETTER_AUTH_SECRET: "a-secure-test-secret-that-is-longer-than-32-characters",
  BETTER_AUTH_URL: "https://starter.example.test",
};

describe("auth network and MFA configuration", () => {
  it("requires an explicit production proxy boundary and never enables an implicit forwarded header", () => {
    expect(() => createAuthIpAddressConfig({ trustedProxyCidrs: [], isProduction: true })).toThrow(
      "BETTER_AUTH_TRUSTED_PROXY_CIDRS",
    );
    expect(createAuthIpAddressConfig({ trustedProxyCidrs: [], isProduction: false })).toEqual({
      ipAddressHeaders: [],
      trustedProxies: [],
    });
    expect(createAuthIpAddressConfig({ trustedProxyCidrs: ["192.0.2.10", "2001:db8::/64"], isProduction: true })).toEqual({
      ipAddressHeaders: ["x-forwarded-for"],
      trustedProxies: ["192.0.2.10", "2001:db8::/64"],
    });
  });

  it("parses only explicit proxy values and marks only a verified TOTP session", () => {
    expect(readAuthEnvironment({ ...authEnvironment, BETTER_AUTH_TRUSTED_PROXY_CIDRS: "192.0.2.10, 2001:db8::/64" })?.trustedProxyCidrs).toEqual(["192.0.2.10", "2001:db8::/64"]);
    expect(() => readAuthEnvironment({ ...authEnvironment, BETTER_AUTH_TRUSTED_PROXY_CIDRS: "192.0.2.10/99" })).toThrow("invalid IP or CIDR");
    expect(() => readAuthEnvironment({ ...authEnvironment, BETTER_AUTH_TRUSTED_PROXY_CIDRS: "999.999.999.999" })).toThrow("invalid IP or CIDR");
    expect(isTotpVerificationPath("/two-factor/verify-totp")).toBe(true);
    expect(isTotpVerificationPath("/two-factor/verify-backup-code")).toBe(false);
    expect(isTotpVerificationPath("/sign-in/username")).toBe(false);
  });

  it("keeps tenant client access fail-closed unless explicitly enabled", () => {
    expect(isClientAccessEnabled({})).toBe(false);
    expect(isClientAccessEnabled({ CLIENT_ACCESS_ENABLED: "false" })).toBe(false);
    expect(isClientAccessEnabled({ CLIENT_ACCESS_ENABLED: "true" })).toBe(true);
  });

  it("pins Better Auth 1.7.2 and keeps public signup closed", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["better-auth"]).toBe(betterAuthPinnedVersion);
    expect(pkg.dependencies["@better-auth/prisma-adapter"]).toBe(betterAuthPinnedVersion);
    expect(createEmailPasswordConfig()).toEqual({
      enabled: true,
      disableSignUp: true,
      minPasswordLength: authPasswordPolicy.existingCredentialMinLength,
      maxPasswordLength: authPasswordPolicy.maxPasswordLength,
    });
    expect(authPasswordPolicy.existingCredentialMinLength).toBe(8);
    expect(authPasswordPolicy.newPasswordMinLength).toBe(12);
  });

  it("requires 12 characters for new operator passwords without tightening existing login hashes", () => {
    expect(() => resetUserPasswordInputSchema.parse({ userId: "user-1", password: "shortpwd" })).toThrow();
    expect(resetUserPasswordInputSchema.parse({ userId: "user-1", password: "twelve-chars" }).password).toHaveLength(12);
    expect(completeAccountSetupInputSchema.parse({ token: "t".repeat(32), password: "twelve-chars" }).password).toHaveLength(12);
    expect(completePlatformRecoveryInputSchema.parse({ token: "t".repeat(32), password: "twelve-chars" }).password).toHaveLength(12);
  });
});
