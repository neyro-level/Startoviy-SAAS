import { publicProjectIdentity } from "../platform/config/project-identity.ts";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: publicProjectIdentity.productName,
    short_name: publicProjectIdentity.shortName,
    description: publicProjectIdentity.description,
    start_url: "/dashboard/",
    scope: "/",
    display: "standalone",
    background_color: "#0c1117",
    theme_color: "#0c1117",
    icons: [
      {
        src: publicProjectIdentity.iconPath,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
