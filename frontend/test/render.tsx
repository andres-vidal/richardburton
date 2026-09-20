import {
  render as rtlRender,
  renderHook as rtlRenderHook,
} from "@testing-library/react";
import { formats } from "i18n/formats";
import { routing } from "i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { ReactElement, ReactNode } from "react";
import { messages } from "./messages";

/**
 * Renders a component with the copy it reads, the way the locale layout
 * supplies it.
 *
 * `useTranslations` throws without a provider, so specs use this in place of
 * Testing Library's `render`. They are written in the default locale.
 */
const Wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider
    locale={routing.defaultLocale}
    messages={messages}
    formats={formats}
  >
    {children}
  </NextIntlClientProvider>
);

export function render(ui: ReactElement, ...rest: unknown[]) {
  return rtlRender(ui, { wrapper: Wrapper, ...(rest[0] as object) });
}

/** A hook that reads copy needs the provider as much as a component does. */
export function renderHook<Result, Props>(
  hook: (props: Props) => Result,
  ...rest: unknown[]
) {
  return rtlRenderHook(hook, { wrapper: Wrapper, ...(rest[0] as object) });
}

export * from "@testing-library/react";
