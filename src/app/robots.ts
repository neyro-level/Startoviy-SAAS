import { publicProjectIdentity } from "../platform/config/project-identity.ts";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/politika/", "/soglasie/", "/cookies/", "/terms/"],
        disallow: ["/dashboard/", "/admin/", "/notifications/", "/api/"],
      },
    ],
    sitemap: `${publicProjectIdentity.publicOrigin}/sitemap.xml`,
    host: publicProjectIdentity.publicOrigin,
  };
}
