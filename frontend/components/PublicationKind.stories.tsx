import type { Meta, StoryObj } from "@storybook/react";
import {
  FIRST_DOM_CASMURRO,
  LONDON_DOM_CASMURRO,
} from "test/publication-fixtures";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import PublicationKind from "./PublicationKind";

const meta = {
  title: "Publications/Publication kind",
  component: PublicationKind,
  args: { kind: "retranslation", follows: [FIRST_DOM_CASMURRO] },
  decorators: [
    (Story) => (
      <div className="p-8 max-w-2xl bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PublicationKind>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A retranslation that follows one publication: the badge, and a sentence
 * that names who first translated the work and links to that publication.
 */
export const Retranslation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Retranslation")).toHaveAttribute(
      "data-kind",
      "retranslation",
    );
    await expect(canvasElement).toHaveTextContent(
      "The work was first translated by Helen Caldwell as Dom Casmurro (1953).",
    );
    await expect(
      canvas.getByRole("link", { name: "Dom Casmurro (1953)" }),
    ).toHaveAttribute("href", "/en/publications/7");
  },
};

/**
 * A retranslation of a work first translated in two publications of one year.
 * The sentence names the year once, and then each publication with its
 * translators, its title, its publisher and its country. Each publication has
 * its own link.
 */
export const RetranslationOfSeveral: Story = {
  args: { follows: [FIRST_DOM_CASMURRO, LONDON_DOM_CASMURRO] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Retranslation")).toBeInTheDocument();
    await expect(canvasElement).toHaveTextContent(
      "The work was first translated in 1953: by Helen Caldwell as Dom Casmurro (Noonday Press, United States) and by Helen Caldwell as Dom Casmurro (W. H. Allen, United Kingdom).",
    );
    await expect(
      canvas.getByRole("link", {
        name: "Dom Casmurro (Noonday Press, United States)",
      }),
    ).toHaveAttribute("href", "/en/publications/7");
    await expect(
      canvas.getByRole("link", {
        name: "Dom Casmurro (W. H. Allen, United Kingdom)",
      }),
    ).toHaveAttribute("href", "/en/publications/10");
  },
};

/**
 * A reissue that follows one publication: the badge, and a sentence that
 * links to the first publication of the same translation.
 */
export const Reissue: Story = {
  args: { kind: "reissue" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Reissue")).toHaveAttribute(
      "data-kind",
      "reissue",
    );
    await expect(canvasElement).toHaveTextContent(
      "This translation was first published as Dom Casmurro (1953).",
    );
    await expect(
      canvas.getByRole("link", { name: "Dom Casmurro (1953)" }),
    ).toHaveAttribute("href", "/en/publications/7");
  },
};

/**
 * A reissue of a translation first published twice in 1953, in the United
 * States and in the United Kingdom. The sentence names the year once, and
 * then each first edition with its title, its publisher and its country. Each
 * first edition has its own link.
 */
export const ReissueOfSeveral: Story = {
  args: {
    kind: "reissue",
    follows: [FIRST_DOM_CASMURRO, LONDON_DOM_CASMURRO],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Reissue")).toBeInTheDocument();
    await expect(canvasElement).toHaveTextContent(
      "This translation was first published in 1953: as Dom Casmurro (Noonday Press, United States) and as Dom Casmurro (W. H. Allen, United Kingdom).",
    );
    await expect(
      canvas.getByRole("link", {
        name: "Dom Casmurro (Noonday Press, United States)",
      }),
    ).toHaveAttribute("href", "/en/publications/7");
    await expect(
      canvas.getByRole("link", {
        name: "Dom Casmurro (W. H. Allen, United Kingdom)",
      }),
    ).toHaveAttribute("href", "/en/publications/10");
  },
};

/**
 * Hovering the info icon beside the badge shows the definitions of the three
 * kinds, the same text the insights charts give.
 */
export const Explained: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole("button", {
        name: "About retranslations",
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "A retranslation is an edition published in the first year of a later translation of the same work.",
      ),
    );
  },
};

/**
 * A retranslation of a work first translated by two people: the sentence
 * lists them as the reader's language joins a list.
 */
export const SeveralTranslators: Story = {
  args: {
    follows: [
      {
        id: 12,
        title: "Gabriela, Clove and Cinnamon",
        year: 1962,
        authors: ["James L. Taylor", "William L. Grossman"],
        publishers: ["Knopf"],
        countries: ["US"],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(
      "first translated by James L. Taylor and William L. Grossman as Gabriela, Clove and Cinnamon (1962).",
    );
  },
};

/** A first translation follows no publication, so nothing is rendered. */
export const FirstTranslation: Story = {
  args: { kind: "first_translation", follows: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toBe("");
    await expect(within(canvasElement).queryByRole("link")).toBeNull();
  },
};
