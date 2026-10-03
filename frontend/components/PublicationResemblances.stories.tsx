import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import { seedLookAlikes } from "test/publication-fixtures";

import PublicationResemblances from "./PublicationResemblances";

const meta = {
  title: "Publications/Resemblance review",
  component: PublicationResemblances,
  args: { isOpen: true, onClose: () => {} },
  parameters: {
    layout: "fullscreen",
    // The modal is full screen and rendered in a portal, so the docs page shows
    // it in an iframe of fixed height.
    docs: { story: { inline: false, height: "34rem" } },
  },
  beforeEach: () => seedLookAlikes(store),
} satisfies Meta<typeof PublicationResemblances>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The first row in the queue is a near-copy of a stored record. The review
 * shows the row and the record.
 */
export const AgainstTheDatabase: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    await expect(
      screen.getByText("Resembles one record already in the database."),
    ).toBeVisible();

    // The row being imported and the record it resembles are both on the page.
    await expect(screen.getByText("The row being imported")).toBeVisible();
    await expect(screen.getByText("Already in the database")).toBeVisible();
    await expect(screen.getByText("1 / 3")).toBeVisible();
  },
};

/**
 * The second row in the queue resembles another row of the same import. Neither
 * row is stored, so the duplicate review cannot show this pair.
 */
export const WithinTheImport: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(
        screen.getByText("Resembles one other row of this import."),
      ).toBeVisible(),
    );
    await expect(screen.getByText("Elsewhere in this import")).toBeVisible();
    await expect(screen.getByText("2 / 3")).toBeVisible();
  },
};

/**
 * Next and Previous move through the queue in both directions. Previous is
 * disabled on the first row, and Next is disabled on the last.
 */
export const ReadingBothWays: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Previous is disabled on the first row.
    await expect(
      screen.getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await expect(await screen.findByText("3 / 3")).toBeVisible();

    // Next is disabled on the last row.
    await expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await expect(await screen.findByText("2 / 3")).toBeVisible();
  },
};

// The text of every highlight in the open review, in reading order.
const highlighted = () =>
  Array.from(
    screen.getByRole("dialog").querySelectorAll("mark"),
    (mark) => mark.textContent,
  );

/**
 * Each card highlights the text it has that another card of the question
 * lacks. Against the stored record, only the typo in the title differs. Between
 * the two rows of the import, the title's last word, the translator's initial
 * and the accented word of the original title differ.
 */
export const WhatDiffers: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    await expect(highlighted()).toEqual(["Casmuro", "Casmurro"]);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await expect(await screen.findByText("2 / 3")).toBeVisible();

    await expect(highlighted()).toEqual([
      "Backlands",
      "L.",
      "Sertão:",
      "Backland",
      "L",
      "Sertao",
    ]);
  },
};
