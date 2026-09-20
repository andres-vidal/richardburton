import type { Preview } from "@storybook/nextjs-vite";
import { formats } from "i18n/formats";
import { routing } from "i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { store } from "modules/store";
import { Author } from "modules/author";
import { Country } from "modules/country";
import { OriginalBook } from "modules/original-book";
import { Publisher } from "modules/publisher";
import { COUNTRIES, messages } from "test/messages";

import "../styles/globals.css";
import "./preview.css";

// There is no server here, so the field is answered from the few countries the
// stories are given.
Country.REMOTE.search = async (term) =>
  COUNTRIES.filter((country) =>
    country.label.toLowerCase().includes(term.toLowerCase()),
  );

/**
 * Every other field answers with nothing, so no story can reach the network.
 *
 * The fields debounce, so a story can end with a request still to be made. A
 * story that stubs one of these puts back a stub rather than the real call.
 */
Author.REMOTE.search = async () => [];
Publisher.REMOTE.search = async () => [];
OriginalBook.REMOTE.search = async () => [];

const preview: Preview = {
  decorators: [
    // Components read their copy from the provider the locale layout supplies.
    // Stories are written in the default locale, so they get that one.
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
    // The app is on the App Router, so components use `next/navigation`. This
    // makes @storybook/nextjs-vite mount the App Router mocks (useRouter/
    // usePathname/useSearchParams) instead of the Pages Router ones.
    nextjs: { appDirectory: true },
    // Every docs canvas gets its own iframe. A story that portals — a modal, a
    // menu — renders into the document it is mounted in, and inline canvases
    // share that document with Storybook itself, so an open dialog covers the
    // docs page instead of the story it belongs to.
    docs: { story: { inline: false, height: "460px" } },
    // Run axe-core on every story via @storybook/addon-a11y. "todo" surfaces
    // violations in the a11y panel + as non-failing notes in the test run; flip
    // to "error" to make accessibility violations fail the suite.
    a11y: { test: "error" },
  },
};

export default preview;
