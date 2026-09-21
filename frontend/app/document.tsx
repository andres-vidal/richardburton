import { getSession } from "app/session";
import type { Locale } from "i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ReactNode } from "react";
import "styles/globals.css";
import { Providers } from "./[locale]/providers";

/**
 * The document a page is served inside: `<html>` carrying the locale, `<body>`,
 * the message catalogue and the client-side providers.
 *
 * This is a component rather than the root layout because the locale is a path
 * segment, and the root layout sits above that segment — it cannot know which
 * locale to write. Anything Next renders above the segment writes the document
 * by calling this, which is why there is only one of them to keep in step.
 */
export default async function Document({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  setRequestLocale(locale);

  const session = await getSession();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale}>
          <Providers session={session}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
