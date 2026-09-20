import { routing, type Locale } from "i18n/routing";
import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import "styles/globals.css";
import { getSession } from "app/session";
import { appUrl } from "modules/app-url";
import { Providers } from "./providers";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const appName = (await getTranslations({ locale, namespace: "layout" }))(
    "appName",
  );
  const description = t("description");

  return {
    metadataBase: new URL(appUrl()),
    title: appName,
    description,
    authors: [{ name: "Andrés Vidal" }],
    keywords: t("keywords")
      .split(",")
      .map((keyword) => keyword.trim()),
    icons: { shortcut: "/favicon.ico" },
    // Each locale is its own URL, and each says where the others are, so the two
    // read as translations of one page rather than as duplicates of it.
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        routing.locales.map((other) => [other, `/${other}`]),
      ),
    },
    openGraph: {
      type: "website",
      siteName: appName,
      title: appName,
      description,
      locale: locale === "pt" ? "pt_BR" : "en_US",
      images: [
        {
          url: "/thumbnail.png",
          alt: `${appName}: ${t("tagline")}`,
          width: 1200,
          height: 627,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: appName,
      description,
      images: [{ url: "/thumbnail.png", alt: `${appName}: ${t("tagline")}` }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  modal,
  params,
}: {
  children: ReactNode;
  /** What is shown *over* the page — a publication followed from the database. */
  modal: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale as Locale);

  const session = await getSession();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <Providers session={session}>
            {children}
            {modal}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
