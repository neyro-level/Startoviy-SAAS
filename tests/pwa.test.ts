import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import manifest from "../src/platform/pwa/manifest.ts";
import { GET as manifestResponse } from "../src/app/manifest.webmanifest/route.ts";
import { publicProjectIdentity, optionalModules } from "../src/platform/config/project-identity.ts";
import { isModuleEnabled } from "../src/platform/config/optional-modules.ts";

describe("PWA baseline", () => {
  it("is installable with neutral app name", () => {
    if (!isModuleEnabled(optionalModules, "pwa")) { expect(manifestResponse().status).toBe(404); return; }
    expect(manifest()).toMatchObject({
      name: publicProjectIdentity.productName,
      short_name: publicProjectIdentity.shortName,
      display: "standalone",
    });
  });

  it("excludes private routes from service worker cache", async () => {
    const source = await readFile("src/platform/pwa/service-worker.js", "utf8");
    for (const privatePath of ["/api/", "/admin/", "/dashboard/", "/notifications/"]) {
      expect(source).toContain(privatePath);
    }
    expect(source).toContain("isPrivateRequest(url)");
    expect(source).toContain("CACHE_PREFIX");
    expect(source).toContain("response.ok");
  });
});
