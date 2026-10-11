import { projectIdentity, publicProjectIdentity } from "../../platform/config/project-identity.ts";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { legalLinks, createLegalOperator } from "../../shared/legal/legal-config.ts";

const legalOperator = createLegalOperator(projectIdentity.identity);

export function SiteFooter() {
  const phoneHref = `tel:${legalOperator.phone.replace(/[^\d+]/g, "")}`;

  return (
    <footer id="site-footer" className="start-landing border-t border-[var(--ch-border-subtle)] bg-[var(--ch-bg-deeper)] text-[var(--ch-white)]" role="contentinfo">
      <div className="mx-auto grid w-full max-w-[1360px] gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.15fr_0.85fr_0.8fr] lg:gap-16 lg:py-18">
        <div>
          <Link href="/" className="inline-flex items-center gap-3" aria-label={`${publicProjectIdentity.productName} - на главную`}>
            <span className="grid size-10 place-items-center border border-[var(--ch-border-control)] bg-[var(--ch-surface-subtle)] text-[11px] font-extrabold">{publicProjectIdentity.brandMark}</span>
            <span className="text-sm font-extrabold">{publicProjectIdentity.brandWordmark}</span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--ch-body-ondark)]">
            Нейтральная стартовая база для кабинетов, CRM, аналитики и внутренних веб-приложений.
          </p>
        </div>

        <nav aria-label="Правовая информация">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ch-accent)]">Документы</h2>
          <div className="mt-5 grid gap-3">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="w-fit text-sm text-[var(--ch-muted-ondark)] transition hover:text-[var(--ch-white)]">
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <address className="not-italic">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ch-accent)]">Контакты</h2>
          <div className="mt-5 grid gap-3">
            <a href={phoneHref} className="w-fit text-sm font-semibold text-[var(--ch-white)] transition hover:text-[var(--ch-soft-white)]">{legalOperator.phone}</a>
            <a href={`mailto:${legalOperator.email}`} className="w-fit text-sm text-[var(--ch-muted-ondark)] transition hover:text-[var(--ch-white)]">{legalOperator.email}</a>
          </div>
        </address>
      </div>

      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-3 border-t border-[var(--ch-border-subtle)] px-5 py-6 text-xs text-[var(--ch-faint-ondark)] sm:px-6 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} {legalOperator.name} · {legalOperator.inn}</p>
        <a href="https://ams24.ru" target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 transition hover:text-[var(--ch-action-ondark)]">
          Разработано в АМС <ArrowUpRight className="size-3.5" strokeWidth={1.6} aria-hidden />
        </a>
      </div>
    </footer>
  );
}
