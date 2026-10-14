import { publicProjectIdentity } from "../../platform/config/project-identity.ts";
import type { Metadata } from "next";
import { LegalDocument } from "../../components/marketing/LegalDocument.tsx";
import { PrivacyContent } from "../../components/marketing/legal/LegalContents.tsx";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: `Политика обработки персональных данных ${publicProjectIdentity.productName}.`,
  alternates: { canonical: "/politika/" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Юридический документ"
      title="Политика обработки персональных данных"
      description="Определяет порядок обработки и меры по обеспечению безопасности персональных данных."
      version="Версия 1.0"
      effectiveDate="24.05.2026"
    >
      <PrivacyContent />
    </LegalDocument>
  );
}
