import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSmokeIdentity } from "../scripts/derivation-smoke.mjs";

const source = JSON.parse(readFileSync(new URL("../starter.identity.json", import.meta.url), "utf8"));

describe("owned derivation proof identity", () => {
  it("preserves a business caller's identity, migration owner and delivery profile", () => {
    const derived = source.mode === "derived" ? source : buildSmokeIdentity(source, "a".repeat(40), "disabled");
    const before = JSON.stringify(derived);
    expect(buildSmokeIdentity(derived, "b".repeat(40), null)).toBe(derived);
    expect(JSON.stringify(derived)).toBe(before);
  });

  it("refuses to change selected capabilities in a derived rehearsal", () => {
    const derived = source.mode === "derived" ? source : buildSmokeIdentity(source, "a".repeat(40), "disabled");
    const mismatched = derived.derivation.optionalModules.pwa === "enabled" ? "disabled" : "enabled";
    expect(() => buildSmokeIdentity(derived, "b".repeat(40), mismatched)).toThrow("preserves");
  });
});
