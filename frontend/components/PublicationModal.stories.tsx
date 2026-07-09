import type { Meta, StoryObj } from "@storybook/react";
import { Publication, resetAll, setAll } from "modules/publication";
import { expect, screen, waitFor } from "storybook/test";

import { PublicationModal } from "./PublicationModal";

// A URL-driven modal: it opens when the `?publication=<id>` query is present and
// renders that publication (read from the store) as a searchable article.
const meta = {
  title: "Publications/Publication modal",
  component: PublicationModal,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PublicationModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No `?publication=` query — the modal stays closed. */
export const Closed: Story = {
  beforeEach: () => resetAll(),
  play: async () => {
    await expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** Opened by a `?publication=1` URL query, showing that publication's details. */
export const Default: Story = {
  beforeEach: () =>
    setAll([
      {
        id: 1,
        publication: {
          ...Publication.empty(),
          title: "Dom Casmurro",
          authors: "Helen Caldwell",
          originalTitle: "Dom Casmurro",
          originalAuthors: "Machado de Assis",
          year: "1953",
          countries: "US",
          publishers: "Noonday Press",
        },
        errors: null,
      },
    ]),
  parameters: {
    nextjs: { router: { query: { publication: "1" } } },
    // Full-screen portalled modal — bound it in the docs page.
    docs: { story: { inline: false, height: "30rem" } },
  },
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // "Helen Caldwell" appears in both the heading and a searchable link.
    await expect(screen.getAllByText(/Helen Caldwell/).length).toBeGreaterThan(
      0,
    );
  },
};
