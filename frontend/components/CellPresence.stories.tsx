import type { Meta, StoryObj } from "@storybook/react";
import { COLOURS } from "modules/publication/presence";
import { expect, screen, userEvent } from "storybook/test";

import CellPresence from "./CellPresence";

const meta = {
  title: "Publications/Cell presence",
  component: CellPresence,
  args: { colour: 0, by: "helen@example.com" },
  // It sits in the corner of a cell, so it is shown in one.
  decorators: [
    (Story) => (
      <div className="relative w-48 h-8 bg-white border border-gray-300">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof CellPresence>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Somebody else's cursor: their initial, in their colour. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByLabelText("helen@example.com has their cursor here"),
    ).toHaveTextContent("H");
  },
};

/** A colour alone says somebody is there; hovering says who. */
export const NamedOnHover: Story = {
  play: async () => {
    await userEvent.hover(
      screen.getByLabelText("helen@example.com has their cursor here"),
    );

    await expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "helen@example.com has their cursor here",
    );
  },
};

/**
 * Every colour a person can be drawn in. The same person is the same colour
 * everywhere, so a cell can be traced to the face at the top of the document.
 */
export const EveryColour: Story = {
  render: () => (
    <div className="flex gap-2">
      {Array.from({ length: COLOURS }, (_, colour) => (
        <div
          key={colour}
          className="relative w-16 h-8 bg-white border border-gray-300"
        >
          <CellPresence colour={colour} by={`person${colour}@example.com`} />
        </div>
      ))}
    </div>
  ),
  decorators: [(Story) => <Story />],
  play: async () => {
    await expect(screen.getAllByText("P")).toHaveLength(COLOURS);
  },
};
