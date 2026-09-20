import type { Preview } from "@storybook/nextjs-vite";
import { formats } from "i18n/formats";
import { routing } from "i18n/routing";
import messages from "../messages/en.json";
import { NextIntlClientProvider } from "next-intl";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { store } from "modules/store";
import { Country, setCountryNames } from "modules/country";

import "../styles/globals.css";
import "./preview.css";

// The server is the only place countries are named, and there is no server
// here, so stories are given a few and the field is answered from them. Which
// countries a term finds is settled in the Country specs, not in a story.
const COUNTRIES = [
  { id: "BR", label: "Brazil" },
  { id: "CA", label: "Canada" },
  { id: "NL", label: "Netherlands", article: "the" },
  { id: "US", label: "United States", article: "the" },
];

setCountryNames(COUNTRIES, routing.defaultLocale);

Country.REMOTE.all = async () => COUNTRIES;
Country.REMOTE.search = async (term) =>
  COUNTRIES.filter((country) =>
    country.label.toLowerCase().includes(term.toLowerCase()),
  );

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
