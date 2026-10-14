import type { Preview } from "@storybook/nextjs-vite";
import { formats } from "i18n/formats";
import { routing } from "i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { store } from "modules/store";
import { REMOTE as PublicationRemote } from "modules/publication/remote";
import { COUNTRIES, messages } from "test/messages";
import { stubLookups } from "test/search-stubs";

import "../styles/globals.css";
import "./preview.css";

// Stories run without a server. The country search answers from `COUNTRIES`,
// every other search and the workspace's look-alike check answer with nothing,
// and no story reaches the network. A story that stubs a search itself puts
// one of these stubs back when it ends, not the real call.
stubLookups(COUNTRIES);
PublicationRemote.resemblances = async () => {};

const preview: Preview = {
  decorators: [
    // Renders every story in the default locale's messages, as the locale
    // layout provides them, and in the workspace store's provider.
    (Story) => (
      <NextIntlClientProvider
        locale={routing.defaultLocale}
        messages={messages}
        formats={formats}
      >
        <PublicationStoreProvider store={store}>
          <Story />
        </PublicationStoreProvider>
      </NextIntlClientProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    // Mocks the App Router's `next/navigation` hooks, which components use.
    nextjs: { appDirectory: true },
    // Renders each docs canvas in its own iframe. A story that portals, such as
    // a modal or a menu, renders into the document it is mounted in, and an
    // inline canvas shares the docs page's document, so an open dialog would
    // cover the docs page.
    docs: { story: { inline: false, height: "460px" } },
    // Runs axe-core on every story, and fails a story's test on a violation.
    a11y: { test: "error" },
  },
};

export default preview;
