import { alternates } from "app/alternates";
import Document from "app/document";
import { routing } from "i18n/routing";
import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import { appUrl } from "modules/app-url";

/** Returns the `locale` param of every locale, so each is rendered ahead. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Returns the metadata every page in `locale` starts from: the app's name and
 * description, the keywords, the icon, the addresses of the index in every
 * locale, and the Open Graph and Twitter cards. A page's own metadata
 * overrides what it sets again.
 */
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
    alternates: alternates("", locale),
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

/** Fits the page to the width of the device, unzoomed. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Renders the document of every page under a locale: the page, and the
 * `@modal` slot over it. A locale the app is not written in is a 404.
 */
export default async function LocaleLayout({
  children,
  modal,
  params,
}: {
  children: ReactNode;
  /** What is shown over the page: a publication opened from the database. */
  modal: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <Document locale={locale}>
      {children}
      {modal}
    </Document>
  );
}
