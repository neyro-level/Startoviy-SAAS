import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { optionalModules } from "../../platform/config/project-identity.ts";
import { isModuleEnabled } from "../../platform/config/optional-modules.ts";
import type { ReactNode } from "react";
import { PrivateApplicationLayout } from "../../components/shell/PrivateApplicationLayout.tsx";

export const metadata: Metadata = {
  title: "Администрирование",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { colorScheme: "light", themeColor: "#edf2f6" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  if (!isModuleEnabled(optionalModules, "platformAdmin")) notFound();
  return <PrivateApplicationLayout>{children}</PrivateApplicationLayout>;
}
