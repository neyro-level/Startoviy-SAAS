import { publicProjectIdentity, optionalModules } from "../platform/config/project-identity.ts";
import { isModuleEnabled } from "../platform/config/optional-modules.ts";
import { ProjectIdentityProvider } from "../components/identity/ProjectIdentityProvider.tsx";
import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "../components/pwa/ServiceWorkerRegistration.tsx";
import { Toaster } from "../components/ui/sonner.tsx";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicProjectIdentity.publicOrigin),
  title: {
    default: publicProjectIdentity.productName,
    template: `%s | ${publicProjectIdentity.productName}`,
  },
  description: publicProjectIdentity.description,
  applicationName: publicProjectIdentity.productName,
  manifest: isModuleEnabled(optionalModules, "pwa") ? "/manifest.webmanifest" : undefined,
  keywords: ["CRM", "аналитический кабинет", "внутреннее веб-приложение", "SaaS starter"],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: publicProjectIdentity.faviconPath, type: "image/svg+xml" }],
    shortcut: publicProjectIdentity.faviconPath,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: publicProjectIdentity.productName,
    title: publicProjectIdentity.productName,
    description: publicProjectIdentity.description,
  },
  twitter: {
    card: "summary",
    title: publicProjectIdentity.productName,
    description: publicProjectIdentity.description,
  },
  appleWebApp: {
    capable: isModuleEnabled(optionalModules, "pwa"),
    title: publicProjectIdentity.productName,
    statusBarStyle: "black-translucent",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0c1117",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full"><ProjectIdentityProvider identity={publicProjectIdentity}><NuqsAdapter>{children}</NuqsAdapter><ServiceWorkerRegistration enabled={isModuleEnabled(optionalModules, "pwa")} cachePrefix={`${publicProjectIdentity.productSlug}-shell-`} /><Toaster /></ProjectIdentityProvider></body>
    </html>
  );
}
