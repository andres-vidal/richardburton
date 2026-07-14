import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  const locale = await requestLocale;

  const finalLocale = routing.locales.includes(locale as any)
    ? locale!
    : routing.defaultLocale;

  return {
    locale: finalLocale,
    messages: (await import(`../messages/${finalLocale}.json`)).default
  };
});