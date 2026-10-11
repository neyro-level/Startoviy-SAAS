import createManifest from "../../platform/pwa/manifest.ts";
import { optionalModules } from "../../platform/config/project-identity.ts";
import { isModuleEnabled } from "../../platform/config/optional-modules.ts";

export const dynamic = "force-dynamic";

export function GET() {
  if (!isModuleEnabled(optionalModules, "pwa")) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json(createManifest(), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } });
}
