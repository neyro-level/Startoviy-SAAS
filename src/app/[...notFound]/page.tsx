import { publicProjectIdentity } from "../../platform/config/project-identity.ts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Страница не найдена",
  description: `Страница не найдена. Вернитесь на главную ${publicProjectIdentity.productName} или выберите доступный раздел.`,
  robots: { index: false, follow: false },
};

export default function CatchAllNotFoundPage() {
  notFound();
}
