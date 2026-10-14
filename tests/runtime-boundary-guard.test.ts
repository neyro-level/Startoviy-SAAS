import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkRuntimeBoundaries } from "../scripts/runtime-boundary-guard.mjs";
import { checkClientSecretBoundary } from "../scripts/client-secret-boundary.mjs";

const owned: string[] = [];
function fixture(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), "runtime-boundary-"));
  owned.push(root);
  for (const [relative, source] of Object.entries(files)) {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source);
  }
  return root;
}
afterEach(() => owned.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("runtime boundary guards", () => {
  it("rejects client reachability to outbound and missing server-only markers", () => {
    const root = fixture({
      "src/platform/http/safe-outbound.ts": 'export const safeOutboundBuffered = () => undefined;\n',
      "src/client.tsx": '"use client"; import { safeOutboundBuffered } from "./platform/http/safe-outbound.ts";\n',
      "src/modules/jobs/run.ts": 'export async function run() { await fetch("https://hooks.example.test"); }\n',
      "src/app/page.tsx": 'export default function Page() { getPrismaClient(); return null; }\n',
    });
    expect(checkRuntimeBoundaries(root)).toEqual([
      "src/app/page.tsx uses the global Prisma client outside the documented repository/auth boundary",
      "src/modules/jobs/run.ts uses raw fetch outside the documented allowlist",
      "src/platform/http/safe-outbound.ts must be server-only",
    ]);
    expect(checkClientSecretBoundary(root)).toEqual(["src/client.tsx imports server secret resolution"]);
  });

  it("allows documented browser lead fetch, the service worker, and Prisma repositories", () => {
    const root = fixture({
      "src/platform/http/safe-outbound.ts": 'import "server-only"; export const safeOutboundBuffered = () => undefined;\n',
      "src/shared/leads/send-lead.ts": 'export async function sendLead() { await fetch("https://hooks.example.test"); }\n',
      "src/platform/pwa/service-worker.js": "self.addEventListener(\"fetch\", (event) => event.respondWith(fetch(event.request)));\n",
      "src/modules/identity-access/infrastructure/prisma-identity-admin-repository.ts": "export function getPrismaClient() { return {}; } getPrismaClient();\n",
    });
    expect(checkRuntimeBoundaries(root)).toEqual([]);
  });
});
