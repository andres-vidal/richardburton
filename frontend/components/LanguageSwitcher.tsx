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

/**
 * Renders a flag button for each language the interface is not currently in.
 * Its accessible name says which language it switches to. Pressing it replaces
 * the address with the same page and query under that language's prefix.
 *
 * Both flags are drawn in the same box, so the button keeps its size.
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
              <Flag className="w-5 h-3.5 rounded-xs" />
            </button>
          );
        })}
    </>
  );
};

export default LanguageSwitcher;
