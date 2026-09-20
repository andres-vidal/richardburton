"use client";

import BrazilFlag from "assets/flag-br.svg";
import BritishFlag from "assets/flag-gb.svg";
import { usePathname, useRouter } from "i18n/navigation";
import { routing, type Locale } from "i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FC, useTransition } from "react";

/** The flag each language is offered under. `pt` is Brazilian Portuguese. */
const FLAGS = { pt: BrazilFlag, en: BritishFlag };

/** One box for both flags, cropped to fill, so the control keeps its size. */
const FLAG_SIZE = "w-5 h-3.5 rounded-xs";

/**
 * Offers the interface in the language it is not currently in.
 *
 * The locale is in the address, so switching navigates to the same page under
 * the other prefix, query string and all.
 */
const LanguageSwitcher: FC = () => {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const query = searchParams?.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <>
      {routing.locales
        .filter((other) => other !== locale)
        .map((other) => {
          const Flag = FLAGS[other];

          return (
            <button
              key={other}
              type="button"
              title={t(other)}
              aria-label={t("switchTo", { language: t(other) })}
              onClick={() =>
                startTransition(() => router.replace(href, { locale: other }))
              }
              className="block rounded-xs opacity-80 transition-opacity focus-ring hover:opacity-100"
            >
              <Flag className={FLAG_SIZE} />
            </button>
          );
        })}
    </>
  );
};

export default LanguageSwitcher;
