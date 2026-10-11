interface LegalIdentity {
  legalOperatorName: string;
  legalOperatorInn: string;
  legalOperatorOgrn: string;
  legalOperatorAddress: string;
  legalOperatorEmail: string;
  legalOperatorPhone: string;
  publicOrigin: string;
}

export function createLegalOperator(identity: LegalIdentity) {
  return {
    name: identity.legalOperatorName,
    inn: identity.legalOperatorInn,
    ogrnip: identity.legalOperatorOgrn,
    address: identity.legalOperatorAddress,
    email: identity.legalOperatorEmail,
    phone: identity.legalOperatorPhone,
    site: identity.publicOrigin,
  };
}

export const publicContacts = {
  telegram: "https://example.com/telegram",
  max: "https://example.com/max",
} as const;

export const legalLinks = [
  { href: "/politika/", label: "Политика конфиденциальности" },
  { href: "/soglasie/", label: "Согласие на обработку данных" },
  { href: "/cookies/", label: "Использование Cookie" },
  { href: "/terms/", label: "Условия сотрудничества" },
] as const;
