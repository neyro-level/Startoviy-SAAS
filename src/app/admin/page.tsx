import { notFound, redirect } from "next/navigation";
import { optionalModules } from "../../platform/config/project-identity.ts";
import { isModuleEnabled } from "../../platform/config/optional-modules.ts";

export default function AdminPage() {
  if (!isModuleEnabled(optionalModules, "platformAdmin")) notFound();
  redirect("/admin/organizations/");
}
