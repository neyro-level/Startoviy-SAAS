import { readFileSync } from "node:fs";
import path from "node:path";
import { optionalModules } from "../../platform/config/project-identity.ts";
import { isModuleEnabled } from "../../platform/config/optional-modules.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  if (!isModuleEnabled(optionalModules, "pwa")) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(readFileSync(path.join(process.cwd(), "src/platform/pwa/service-worker.js"), "utf8"), {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store", "Service-Worker-Allowed": "/" },
  });
}
