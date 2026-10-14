import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/platform/observability/logger.ts";
import { createSecretRefStatus, defineSecretRef, resolveSecretRef, type SecretRef } from "../src/platform/security/secret-ref.ts";

describe("server-owned environment SecretRef", () => {
  it("resolves late and exposes only status or masked serialization outside the adapter", () => {
    const environment = { ADAPTER_CREDENTIAL: "synthetic-owned-value-111" };
    const ref = defineSecretRef("ADAPTER_CREDENTIAL");
    expect(resolveSecretRef(ref, environment) === environment.ADAPTER_CREDENTIAL).toBe(true);
    environment.ADAPTER_CREDENTIAL = "synthetic-rotated-value-222";
    expect(resolveSecretRef(ref, environment) === environment.ADAPTER_CREDENTIAL).toBe(true);
    const status = createSecretRefStatus(ref, environment);
    expect(status).toEqual({ configured: true, displayValue: "[REDACTED]" });
    const event = { reference: ref, status };
    const outputs = [JSON.stringify(event), String(ref), `${ref}`, inspect(ref), JSON.stringify({ ...ref }), inspect(event)];
    const lines: string[] = [];
    createLogger(undefined, { write(chunk: string) { lines.push(chunk); } }).info(event, "adapter configuration");
    for (const output of [...outputs, ...lines]) {
      expect(output.includes(environment.ADAPTER_CREDENTIAL)).toBe(false);
      expect(output.includes("synthetic-owned-value-111")).toBe(false);
    }
    expect(Object.isFrozen(ref)).toBe(true);
    expect(String(ref)).toBe("[SECRET_REF]");
  });
  it("fails with a fixed unavailable code and no value when configuration disappears", () => {
    const ref = defineSecretRef("ADAPTER_CREDENTIAL");
    for (const environment of [{}, { ADAPTER_CREDENTIAL: "" }]) {
      expect(createSecretRefStatus(ref, environment)).toEqual({ configured: false, displayValue: "[REDACTED]" });
      expect(() => resolveSecretRef(ref, environment)).toThrow("SECRET_UNAVAILABLE");
    }
  });
  it("rejects injected names and forged or cloned references before reading the environment", () => {
    for (const name of ["lowercase", "", "../../private", "A\nB", "A".repeat(129)]) expect(() => defineSecretRef(name)).toThrow("SECRET_REFERENCE_INVALID");
    const ref = defineSecretRef("ADAPTER_CREDENTIAL");
    let reads = 0;
    const environment = { get ADAPTER_CREDENTIAL() { reads += 1; return "synthetic-never-read"; } };
    for (const forged of [null, { ...ref }, { kind: "environment", name: "ADAPTER_CREDENTIAL" }]) {
      expect(() => resolveSecretRef(forged as SecretRef, environment)).toThrow("SECRET_REFERENCE_INVALID");
      expect(() => createSecretRefStatus(forged as SecretRef, environment)).toThrow("SECRET_REFERENCE_INVALID");
    }
    expect(reads).toBe(0);
  });
});
