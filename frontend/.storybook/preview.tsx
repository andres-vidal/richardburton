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
  },
};

export default preview;
