"use client";

import BrazilFlag from "assets/flag-br.svg";
import BritishFlag from "assets/flag-gb.svg";
import { usePathname, useRouter } from "i18n/navigation";
import { routing, type Locale } from "i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FC, useTransition } from "react";

/**
 * The flag each language is offered under.
 *
 * A flag names a country rather than a language, which is a fair objection in
 * general. It holds here: `pt` is Brazilian Portuguese, for a Brazilian
 * audience. English has no country of its own to point at, so it takes the
 * conventional one.
 */
const FLAGS = { pt: BrazilFlag, en: BritishFlag };

/**
 * The box every flag is drawn in.
 *
 * Brazil's flag is 10:7 and the United Kingdom's is 2:1, so a shared box keeps
 * the control from changing size when the language does. The wider one is
 * cropped to fill it rather than letterboxed.
 */
const FLAG_SIZE = "w-5 h-3.5 rounded-xs";

/**
 * Offers the interface in the other language it is written in.
 *
 * Only the language being offered is shown — the one in use is the page the
 * reader is already on. The flag carries no meaning on its own, so the language
 * names it and screen readers get that name rather than the picture.
 *
 * The locale lives in the address, so switching is a navigation to the same page
 * under the other prefix. `usePathname` gives the path without it, which is what
 * the router wants back.
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
