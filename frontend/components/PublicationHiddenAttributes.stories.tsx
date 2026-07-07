import type { Meta, StoryObj } from "@storybook/react";
import {
  Publication,
  setAttributesVisible,
  useVisibleAttributes,
} from "modules/publication";
import { seed } from "modules/publication/fixtures";
import { FC } from "react";
import { expect, within } from "storybook/test";

import PublicationHiddenAttributes from "./PublicationHiddenAttributes";

// Story-only affordance. In the app, columns are hidden from the index table's
// column headers; these buttons stand in for that so the panel can be exercised
// on its own — hide a column to send it here, click its chip to bring it back.
const HideControls: FC = () => {
  const visible = useVisibleAttributes();

  return (
    <div className="flex flex-wrap gap-2">
      {visible
        .filter((key) => Publication.ATTRIBUTE_IS_TOGGLEABLE[key])
        .map((key) => (
          <button
            key={key}
            className="rounded border border-indigo-600 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
            onClick={() => setAttributesVisible([key], false)}
          >
            Hide {Publication.ATTRIBUTE_LABELS[key]}
          </button>
        ))}
    </div>
  );
};

const meta = {
  title: "Publications/Publication hidden attributes",
  component: PublicationHiddenAttributes,
  decorators: [
    (Story) => (
      <div className="flex flex-col gap-4">
        <HideControls />
        {/* The chips are full-height vertical strips, so give them room. */}
        <div className="flex h-64">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof PublicationHiddenAttributes>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Hide a column with the buttons above and it drops into the panel as a chip;
 * click the chip to restore it. Starts with Year hidden.
 */
export const Default: Story = {
  beforeEach: () => {
    seed();
    setAttributesVisible(["year"], false);
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Show Year" }),
    ).toBeInTheDocument();
  },
};

/** Several columns hidden — one restore chip each. */
export const MultipleHidden: Story = {
  beforeEach: () => {
    seed();
    setAttributesVisible(["year", "publishers", "countries"], false);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Show Year" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Show Publishers" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Show Countries" }),
    ).toBeInTheDocument();
  },
};

/** Nothing hidden — no restore chips (use the buttons above to hide one). */
export const NoneHidden: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("button", { name: /^Show/ }),
    ).toBeNull();
  },
};
