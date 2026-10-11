import Link from "next/link";
import { optionalModules } from "../../../platform/config/project-identity.ts";
import { isModuleEnabled } from "../../../platform/config/optional-modules.ts";
import {
  PLATFORM_ADMIN_RESOURCES,
} from "../../../modules/platform-admin/index.ts";
import { cn } from "../../../shared/lib/cn.ts";

export function AdminResourceNav({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label="Разделы администрирования" className="flex flex-wrap gap-2">
      {PLATFORM_ADMIN_RESOURCES.filter((item) => item.key !== "operations" || isModuleEnabled(optionalModules, "outboxPlusQueue")).map((item) => {
        const active = currentPath === item.href;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius)] border px-4 text-sm font-semibold transition-colors",
              active
                ? "border-[var(--primary)] bg-[var(--primary)] text-app-primary-foreground"
                : "border-[var(--border)] bg-[var(--card)] text-app-secondary hover:bg-[var(--muted)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
