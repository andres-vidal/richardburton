import {
  render as rtlRender,
  renderHook as rtlRenderHook,
} from "@testing-library/react";
import { formats } from "i18n/formats";
import { routing } from "i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { ReactElement, ReactNode } from "react";
import { messages } from "./messages";

// Provides the default locale's messages, as the locale layout provides them.
const Wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider
    locale={routing.defaultLocale}
    messages={messages}
    formats={formats}
  >
    {children}
  </NextIntlClientProvider>
);

/**
 * Renders `ui` with Testing Library's `render`, inside the messages of the
 * default locale. `useTranslations` throws without them.
 */
export function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper });
}

/** Renders `hook` like `render`, inside the messages of the default locale. */
export function renderHook<Result>(hook: () => Result) {
  return rtlRenderHook(hook, { wrapper: Wrapper });
}

export * from "@testing-library/react";
