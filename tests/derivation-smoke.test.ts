import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSmokeIdentity, derivationProofStatus } from "../scripts/derivation-smoke.mjs";

const source = JSON.parse(readFileSync(new URL("../starter.identity.json", import.meta.url), "utf8"));

describe("owned derivation proof identity", () => {
  it("reserves acceptance PASS for two completed matching proofs", () => {
    const run = { cleanup: "PASS", fingerprint: "same-files", native: { status: "PASS" }, browser: { status: "PASS" } };
    expect(derivationProofStatus([run], 1)).toBe("DIAGNOSTIC_COMPLETE_REPEATABILITY_NOT_PROVEN");
    expect(derivationProofStatus([run], 2)).toBe("INCOMPLETE_REPEATABILITY_PROOF");
    expect(derivationProofStatus([run, { ...run, fingerprint: "changed-files" }], 2)).toBe("INCOMPLETE_REPEATABILITY_PROOF");
    expect(derivationProofStatus([run, { ...run, native: { status: "BLOCKED" } }], 2)).toBe("LOCAL_PASS_EXTERNAL_PROOF_INCOMPLETE");
    expect(derivationProofStatus([run, { ...run, cleanup: "FAIL" }], 2)).toBe("INCOMPLETE_REPEATABILITY_PROOF");
    expect(derivationProofStatus([run, run], 2)).toBe("PASS");
  });
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
