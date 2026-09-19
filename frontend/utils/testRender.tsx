import { render as rtlRender } from "@testing-library/react";
import { formats } from "i18n/formats";
import { routing } from "i18n/routing";
import messages from "messages/en.json";
import { NextIntlClientProvider } from "next-intl";
import { ReactElement, ReactNode } from "react";

/**
 * Renders a component with the copy it reads, the way the locale layout
 * supplies it.
 *
 * A component that calls `useTranslations` throws without a provider, so specs
 * use this in place of Testing Library's own `render`. Specs are written in the
 * default locale, so they get that one.
 */
export function render(ui: ReactElement, ...rest: unknown[]) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={messages}
      formats={formats}
    >
      {children}
    </NextIntlClientProvider>
  );

  return rtlRender(ui, { wrapper: Wrapper, ...(rest[0] as object) });
}

export * from "@testing-library/react";
