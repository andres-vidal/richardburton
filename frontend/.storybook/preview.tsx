import type { Preview } from "@storybook/nextjs-vite";
import { Provider } from "jotai";
import { store } from "modules/store";

import "../styles/globals.css";
import "./preview.css";

const preview: Preview = {
  // Every story runs inside the app's Jotai store, so publication components can
  // be seeded with the store's actions (see modules/publication/fixtures).
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    // Run axe-core on every story via @storybook/addon-a11y. "todo" surfaces
    // violations in the a11y panel + as non-failing notes in the test run; flip
    // to "error" to make accessibility violations fail the suite.
    a11y: { test: "error" },
  },
};

export default preview;
