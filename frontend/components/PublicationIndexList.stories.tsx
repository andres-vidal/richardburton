import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { resetAll } from "modules/publication/store";
import { sampleManyPublications, seedIndex } from "test/publication-fixtures";
import { expect, waitFor, within } from "storybook/test";

import { PublicationIndexList } from "./PublicationIndexList";

const meta = {
  title: "Publications/Index list",
  component: PublicationIndexList,
  args: { onItemClick: () => {} },
  parameters: { layout: "padded" },
} satisfies Meta<typeof PublicationIndexList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The mobile list populated with a few publications. */
export const Default: Story = {
  beforeEach: () => seedIndex(store),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("The Hour of the Star"),
    ).toBeInTheDocument();
  },
};

/**
 * A long list draws only the entries near the viewport, and draws the others as
 * they are scrolled to. An entry not drawn yet is an empty box of about an
 * entry's height.
 */
export const DrawsAsItIsScrolled: Story = {
  beforeEach: () => seedIndex(store, sampleManyPublications(60)),
  play: async ({ canvasElement }) => {
    const entries = canvasElement.querySelectorAll("li");
    const last = entries[entries.length - 1];

    await waitFor(() =>
      expect(entries[0]).toHaveAttribute("data-drawn", "true"),
    );
    await expect(last).toHaveAttribute("data-drawn", "false");
    await expect(last.getBoundingClientRect().height).toBeGreaterThan(100);

    last.scrollIntoView();
    await waitFor(() => expect(last).toHaveAttribute("data-drawn", "true"));
    await expect(last).toHaveTextContent("The Devil to Pay in the Backlands");
  },
};

/**
 * A list under `display: none`, the way a breakpoint hides it, draws no
 * publications. The visible list above it draws the same publications, which
 * shows that the hidden entries had their chance to draw.
 */
export const Hidden: Story = {
  beforeEach: () => seedIndex(store),
  render: (args) => (
    <>
      <PublicationIndexList {...args} />
      <div className="hidden">
        <PublicationIndexList {...args} />
      </div>
    </>
  ),
  play: async ({ canvasElement }) => {
    const [shown, hidden] = canvasElement.querySelectorAll("ol");

    await expect(
      await within(shown).findByText("The Hour of the Star"),
    ).toBeInTheDocument();
    await expect(hidden.querySelectorAll("li")).toHaveLength(3);
    await expect(hidden.textContent).toBe("");
  },
};

/** A search that matched nothing. */
export const Empty: Story = {
  beforeEach: () => seedIndex(store, []),
};

/** Ids not loaded yet — the skeleton placeholder. */
export const Loading: Story = {
  beforeEach: () => resetAll(store),
};
