import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseProjectIdentity, parseProjectIdentityJson, toPublicProjectIdentity } from "../src/platform/config/identity-contract.ts";
import { createLegalOperator } from "../src/shared/legal/legal-config.ts";

const fixture = () => JSON.parse(readFileSync("starter.identity.json", "utf8"));

describe("project identity V2", () => {
  it("provides one validated identity to public surfaces and server runtime names", () => {
    const input = fixture();
    Object.assign(input.identity, {
      productName: "Atlas Portal", shortName: "Atlas", productSlug: "atlas-portal",
      publicOrigin: "https://atlas.example.com", serviceId: "atlas-web", workerId: "atlas-worker",
      databaseApplicationPrefix: "atlas-db", artifactPrefix: "atlas-artifact",
      iconPath: "/atlas-icon.svg", faviconPath: "/atlas-favicon.svg", brandMark: "AP", brandWordmark: "PORTAL",
    });
    input.derivation.migrationOwner = "atlas-portal";
    const config = parseProjectIdentity(input);
    expect(toPublicProjectIdentity(config)).toMatchObject({ productName: "Atlas Portal", publicOrigin: "https://atlas.example.com", iconPath: "/atlas-icon.svg" });
    expect(config.identity).toMatchObject({ serviceId: "atlas-web", workerId: "atlas-worker", databaseApplicationPrefix: "atlas-db", artifactPrefix: "atlas-artifact" });
    expect(createLegalOperator(config.identity).site).toBe("https://atlas.example.com");
  });

  it.each(["../escape", "Upper-Case", "foo;command", "a b", "-prefix"])("rejects unsafe slug %s", (value) => {
    const input = fixture(); input.identity.productSlug = value;
    expect(() => parseProjectIdentity(input)).toThrow("identity.productSlug");
  });

  it.each(["not-a-url", "http://example.com", "https://example.com/path", "https://user:credential@example.com", "https://example.com?key=opaque"])("rejects noncanonical or unsafe origin %s", (value) => {
    const input = fixture(); input.identity.publicOrigin = value;
    expect(() => parseProjectIdentity(input)).toThrow("identity.publicOrigin");
  });

  it("rejects credential fields without echoing their values", () => {
    for (const owner of ["root", "identity", "derivation"]) {
      const input = fixture();
      const target = owner === "root" ? input : input[owner];
      target.secret = "synthetic-credential-never-echo";
      let message = "";
      try { parseProjectIdentity(input); } catch (error) { message = (error as Error).message; }
      expect(message).toContain("Invalid project identity");
      expect(message).not.toContain(target.secret);
    }
  });

  it("does not echo malformed JSON contents", () => {
    expect(() => parseProjectIdentityJson('{"secret":"synthetic-do-not-echo", broken'))
      .toThrow("Invalid project identity: JSON format");
  });

  it("whitelists the client DTO and omits legal, source and operational fields", () => {
    const config = parseProjectIdentity(fixture());
    const dto = toPublicProjectIdentity(config);
    expect(Object.keys(dto).sort()).toEqual([
      "brandMark", "brandWordmark", "description", "faviconPath", "iconPath", "productName", "productSlug", "publicOrigin", "shortName",
    ]);
    for (const key of ["legalOperatorName", "sourceRevision", "derivation", "serviceId", "workerId", "databaseApplicationPrefix", "artifactPrefix"]) expect(dto).not.toHaveProperty(key);
  });

  it("requires real inputs, own migration scope and an exact source revision for derived mode", () => {
    const input = fixture(); input.mode = "derived";
    expect(() => parseProjectIdentity(input)).toThrow("Invalid project identity");
    input.derivation.migrationOwner = "different-product";
    expect(() => parseProjectIdentity(input)).toThrow("derivation.migrationOwner");
  });

  it("rejects a legal placeholder in every derived operator field", () => {
    const input = fixture();
    input.mode = "derived";
    input.identity.publicOrigin = "https://atlas.example.com";
    input.derivation.sourceRevision = "1".repeat(40);
    input.legalReferences.status = "REQUIRES_CHECK";
    const complete = {
      legalOperatorName: "Synthetic Operator", legalOperatorEmail: "operator@atlas.example.com",
      legalOperatorAddress: "Synthetic Fixture Address", legalOperatorInn: "1234567890",
      legalOperatorOgrn: "1234567890123", legalOperatorPhone: "+10000000000",
    };
    Object.assign(input.identity, complete);
    expect(() => parseProjectIdentity(input)).not.toThrow();
    for (const [field, value] of Object.entries(complete)) {
      input.identity[field] = ["TO", "DO:", " unresolved"].join("");
      expect(() => parseProjectIdentity(input)).toThrow(`identity.${field}`);
      input.identity[field] = value;
    }
  });

  it("rejects private or outside-repository inventory paths", () => {
    for (const value of [".env.local", "../another-repository", "/etc/credentials"]) {
      const input = fixture(); input.surfaceInventory.product = [value];
      expect(() => parseProjectIdentity(input)).toThrow("surfaceInventory.product");
    }
  });
});
