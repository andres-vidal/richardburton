import type { Meta, StoryObj } from "@storybook/react";
import { COLOURS } from "modules/publication/presence";
import { expect, screen, userEvent } from "storybook/test";

import CellPresence from "./CellPresence";

const meta = {
  title: "Publications/Cell presence",
  component: CellPresence,
  args: { colour: 0, by: "helen@example.com" },
  // The component positions itself in the corner of its parent, so the stories
  // render it inside a cell-sized box.
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

/** Another person's initial, in their colour. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByLabelText("helen@example.com has their cursor here"),
    ).toHaveTextContent("H");
  },
};

/** Hovering the initial shows a tooltip with the person's email. */
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
 * Every presence colour, one per cell. A person has the same colour here and in
 * `DocumentPresence`.
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
