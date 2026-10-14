import type { Meta, StoryObj } from "@storybook/react";
import { ComponentProps, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import QueueListbox, { QueueHeading } from "./QueueListbox";

const TITLES = [
  "Dom Casmurro",
  "Iraçéma the Honey-Lips",
  "The Devil to Pay",
  "Barren Lives",
];

type Args = ComponentProps<typeof QueueListbox<string>>;

/**
 * Holds the selection, as the views that use the listbox do, so a click or a
 * key press moves it. Each selection is also reported to `onSelect`.
 */
const Stateful = (args: Args) => {
  const [position, setPosition] = useState(args.position);

  return (
    <QueueListbox
      {...args}
      position={position}
      onSelect={(next) => {
        args.onSelect(next);
        setPosition(next);
      }}
    />
  );
};

const meta = {
  title: "Components/Queue listbox",
  component: QueueListbox<string>,
  render: (args) => <Stateful {...args} />,
  args: {
    heading: "Possible duplicates",
    count: TITLES.length,
    label: "Clusters of possible duplicates",
    items: TITLES,
    itemKey: (title) => title,
    renderOption: (title) => <span className="truncate">{title}</span>,
    position: 0,
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div className="flex h-80 bg-white">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<Args>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The heading with its count, and the list with the first option selected. The
 * list points `aria-activedescendant` at the selected option.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Possible duplicates")).toBeVisible();
    await expect(canvas.getByText("4")).toBeVisible();

    const options = canvas.getAllByRole("option");
    await expect(options).toHaveLength(4);
    await expect(options[0]).toHaveAttribute("aria-selected", "true");
    await expect(options[1]).toHaveAttribute("aria-selected", "false");
    await expect(
      canvas.getByRole("listbox", { name: "Clusters of possible duplicates" }),
    ).toHaveAttribute("aria-activedescendant", options[0].id);
  },
};

/**
 * The list is one tab stop. The play test checks that the arrows step through
 * the options without passing either end, that Home and End jump to the first
 * and last, and that `aria-activedescendant` follows the selection.
 */
export const Keyboard: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const listbox = canvas.getByRole("listbox");
    const options = canvas.getAllByRole("option");

    await userEvent.tab();
    await expect(listbox).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    await expect(args.onSelect).toHaveBeenLastCalledWith(1);
    await expect(options[1]).toHaveAttribute("aria-selected", "true");
    await expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      options[1].id,
    );

    await userEvent.keyboard("{End}");
    await expect(args.onSelect).toHaveBeenLastCalledWith(3);

    await userEvent.keyboard("{ArrowDown}");
    await expect(args.onSelect).toHaveBeenLastCalledWith(3);

    await userEvent.keyboard("{Home}");
    await expect(args.onSelect).toHaveBeenLastCalledWith(0);

    await userEvent.keyboard("{ArrowUp}");
    await expect(args.onSelect).toHaveBeenLastCalledWith(0);
    await expect(options[0]).toHaveAttribute("aria-selected", "true");
  },
};

/** A click on an option selects it. */
export const Click: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("option", { name: "The Devil to Pay" }),
    );

    await expect(args.onSelect).toHaveBeenCalledWith(2);
    await expect(
      canvas.getByRole("option", { name: "The Devil to Pay" }),
    ).toHaveAttribute("aria-selected", "true");
  },
};

/**
 * With `position` at -1 no option is selected, and the list has no
 * `aria-activedescendant`. The down arrow then selects the first option.
 */
export const NothingSelected: Story = {
  args: { position: -1 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const listbox = canvas.getByRole("listbox");

    await expect(
      canvas.queryByRole("option", { selected: true }),
    ).not.toBeInTheDocument();
    await expect(listbox).not.toHaveAttribute("aria-activedescendant");

    listbox.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(args.onSelect).toHaveBeenCalledWith(0);
  },
};

/**
 * Children are shown in the column below the list, here a second
 * `QueueHeading` whose count is `quiet`.
 */
export const WithContentBelow: Story = {
  args: {
    children: (
      <div className="border-t border-gray-200">
        <QueueHeading heading="Ruled apart" count={2} quiet />
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Ruled apart")).toBeVisible();
    await expect(within(canvasElement).getByText("2")).toHaveAttribute(
      "data-quiet",
      "true",
    );
  },
};
