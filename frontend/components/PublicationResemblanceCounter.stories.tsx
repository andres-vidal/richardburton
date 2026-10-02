import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import {
  reviewingAtom,
  setDiscarded,
  setResemblances,
} from "modules/publication/store";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import {
  LOOK_ALIKE_IDS as ids,
  seedLookAlikes,
} from "test/publication-fixtures";

import PublicationResemblanceCounter from "./PublicationResemblanceCounter";

const meta = {
  title: "Publications/Resemblance counter",
  component: PublicationResemblanceCounter,
  beforeEach: () => seedLookAlikes(store),
  decorators: [
    (Story) => (
      <div className="flex p-8 bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PublicationResemblanceCounter>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * All three rows resemble something. The first resembles a stored record, and
 * the other two resemble each other. Clicking the count opens the review at the
 * start of its queue.
 */
export const Found: Story = {
  play: async () => {
    const button = await screen.findByRole("button", {
      name: "3 rows look like publications already known",
    });
    await expect(button).toHaveTextContent("3");

    await userEvent.click(button);
    await waitFor(() =>
      expect(store.get(reviewingAtom)).toEqual({ startAt: undefined }),
    );
  },
};

/** No row resembles anything, so the counter renders no button. */
export const NothingAlike: Story = {
  beforeEach: () => {
    seedLookAlikes(store);
    setResemblances(store, ids, new Map());
  },
  play: async () => {
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  },
};

/**
 * Discarding a row that resembles something lowers the count from 3 to 2. The
 * count also falls when a row is edited so that it no longer resembles
 * anything.
 */
export const DiscardingLowersIt: Story = {
  play: async () => {
    await expect(
      await screen.findByRole("button", {
        name: "3 rows look like publications already known",
      }),
    ).toBeVisible();

    setDiscarded(store, [ids[0]]);

    await expect(
      await screen.findByRole("button", {
        name: "2 rows look like publications already known",
      }),
    ).toBeVisible();
  },
};
