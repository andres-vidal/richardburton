import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import LinkedText from "./LinkedText";

const CATALOG = "https://catalog.hathitrust.org/Record/001270334";

const meta = {
  title: "Components/Linked text",
  component: LinkedText,
} satisfies Meta<typeof LinkedText>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A URL in the text is a link that opens in a new tab. The play test checks
 * the link's address, and that the full stop ending the sentence stays outside
 * it.
 */
export const WithUrl: Story = {
  args: { children: `Caldwell, Helen. Catalog record, ${CATALOG}.` },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: CATALOG });

    await expect(link).toHaveAttribute("href", CATALOG);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(canvasElement).toHaveTextContent(
      `Caldwell, Helen. Catalog record, ${CATALOG}.`,
    );
  },
};

/**
 * A web address without a scheme links over HTTPS, and an email address links
 * to a new message. The play test checks both addresses.
 */
export const AddressesWithoutAScheme: Story = {
  args: {
    children:
      "Scanned at www.brasiliana.usp.br, on request to acervo@bbm.usp.br",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("link", { name: "www.brasiliana.usp.br" }),
    ).toHaveAttribute("href", "https://www.brasiliana.usp.br");
    await expect(
      canvas.getByRole("link", { name: "acervo@bbm.usp.br" }),
    ).toHaveAttribute("href", "mailto:acervo@bbm.usp.br");
  },
};

/**
 * A word the search matched inside a URL is highlighted inside the link, and
 * the link still goes to the whole URL. The play test checks the mark and the
 * address.
 */
export const MatchedInsideAUrl: Story = {
  args: {
    children: "Scan: https://archive.org/details/[[Iracema]]00alen, page 7.",
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link");

    await expect(link).toHaveAttribute(
      "href",
      "https://archive.org/details/Iracema00alen",
    );
    await expect(link.querySelector("mark")).toHaveTextContent("Iracema");
  },
};

/**
 * Text without a URL renders as `Highlight` renders it, with its marks and no
 * links. The play test checks both.
 */
export const WithoutAUrl: Story = {
  args: { children: "Pontiero, Giovanni. [[Afterword]]." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("link")).toBeNull();
    await expect(canvasElement.querySelector("mark")).toHaveTextContent(
      "Afterword",
    );
  },
};
