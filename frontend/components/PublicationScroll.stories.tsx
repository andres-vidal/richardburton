import type { Meta, StoryObj } from "@storybook/react";
import { empty } from "modules/publication/model";
import {
  drawnCountAtom,
  hydrate,
  isLoadingMoreAtom,
  orderAtom,
  perPageAtom,
} from "modules/publication/store";
import { store } from "modules/store";
import { expect, within } from "storybook/test";

import PublicationScroll from "./PublicationScroll";

const page = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => ({ ...empty(), id: from + i }));

const order = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

const meta = {
  title: "Publications/Publication scroll",
  component: PublicationScroll,
  // Reads the search from the address; there is no search here.
  parameters: { nextjs: { navigation: { pathname: "/" } } },
} satisfies Meta<typeof PublicationScroll>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A page is loaded and more remain, so a sentinel sits at the foot of the list;
 * reaching it fetches the next page. While that page is in flight it says so.
 * (The fetch-on-scroll itself is exercised by the E2E suite, against a real
 * server.)
 */
export const LoadingMore: Story = {
  beforeEach: () => {
    hydrate(store, page(1, 51));
    store.set(orderAtom, order(120));
    store.set(perPageAtom, 50);
    store.set(drawnCountAtom, 50);
    store.set(isLoadingMoreAtom, true);
    return () => store.set(isLoadingMoreAtom, false);
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Loading more…"),
    ).toBeVisible();
  },
};

/** Every record is loaded, so there is nothing to fetch and no sentinel at all. */
export const AllLoaded: Story = {
  beforeEach: () => {
    hydrate(store, page(1, 31));
    store.set(orderAtom, order(30));
    store.set(perPageAtom, 50);
    store.set(drawnCountAtom, 30);
    store.set(isLoadingMoreAtom, false);
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-live]")).toBeNull();
  },
};
