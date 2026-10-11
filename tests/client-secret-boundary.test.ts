import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkClientSecretBoundary } from "../scripts/client-secret-boundary.mjs";

const owned: string[] = [];
function fixture(client: string, bridge = 'export { resolveSecretRef } from "./platform/security/secret-ref.ts";') {
  const root = mkdtempSync(path.join(tmpdir(), "client-secret-boundary-")); owned.push(root);
  mkdirSync(path.join(root, "src/platform/security"), { recursive: true });
  mkdirSync(path.join(root, "src/platform/config"), { recursive: true });
  writeFileSync(path.join(root, "src/platform/security/secret-ref.ts"), 'import "server-only"; export const resolveSecretRef = () => undefined; export type SecretRef = object;');
  writeFileSync(path.join(root, "src/platform/config/server-environment.ts"), 'export const readAuthEnvironment = () => undefined;');
  writeFileSync(path.join(root, "src/bridge.ts"), bridge);
  writeFileSync(path.join(root, "src/client.tsx"), client);
  writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }));
  return root;
}
afterEach(() => owned.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
describe("transitive client-to-secret import guard", () => {
  it.each([
    '"use client"; import { resolveSecretRef } from "./platform/security/secret-ref.ts";',
    "'use client'; import { resolveSecretRef } from './bridge.ts';",
    '"use client"; import("./bridge.ts");',
    '"use client"; require("./bridge.ts");',
    '"use client"; import { resolveSecretRef } from "@/bridge.ts";',
    '"use client"; import { readAuthEnvironment } from "./platform/config/server-environment.ts";',
  ])("rejects runtime reachability through imports, exports, aliases or dynamic imports", (client) => {
    expect(checkClientSecretBoundary(fixture(client))).toEqual(["src/client.tsx imports server secret resolution"]);
  });
  it("allows erased type-only imports and genuine server-action RPC boundaries", () => {
    expect(checkClientSecretBoundary(fixture('"use client"; import type { SecretRef } from "./platform/security/secret-ref.ts";'))).toEqual([]);
    expect(checkClientSecretBoundary(fixture('"use client"; import { type SecretRef } from "./platform/security/secret-ref.ts";'))).toEqual([]);
    expect(checkClientSecretBoundary(fixture('"use client"; import { action } from "./bridge.ts";', '"use server"; import { resolveSecretRef } from "./platform/security/secret-ref.ts"; export async function action() {}'))).toEqual([]);
  });
  it("does not confuse a later string literal with a server-action directive", () => {
    const root = fixture('"use client"; import { resolveSecretRef } from "./bridge.ts";', 'import { resolveSecretRef } from "./platform/security/secret-ref.ts"; "use server"; export { resolveSecretRef };');
    expect(checkClientSecretBoundary(root)).toEqual(["src/client.tsx imports server secret resolution"]);
  });
  it("also blocks transitive reachability to the existing raw server environment reader", () => {
    const root = fixture('"use client"; import { readAuthEnvironment } from "./bridge.ts";', 'export { readAuthEnvironment } from "./platform/config/server-environment.ts";');
    expect(checkClientSecretBoundary(root)).toEqual(["src/client.tsx imports server secret resolution"]);
  });
});
