import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import MenuProvider, { MenuOption } from "./MenuProvider";

const options: MenuOption[] = [
  { id: "1", label: "Dom Casmurro" },
  { id: "2", label: "Memórias Póstumas" },
  { id: "3", label: "Quincas Borba" },
];

/**
 * MenuProvider is fully controlled — open state, active index, and selection all
 * live in the parent. This harness wires them up so the menu is interactive.
 */
const Harness = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<string>();

  return (
    <div className="flex flex-col gap-2 items-start">
      <MenuProvider
        options={options}
        isOpen={isOpen}
        activeIndex={activeIndex}
        setIsOpen={setIsOpen}
        setActiveIndex={setActiveIndex}
        onSelect={(option) => setSelected(option.label)}
      >
        <button
          aria-label="Open menu"
          className="px-3 py-1 rounded border"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          Open menu
        </button>
      </MenuProvider>
      <span data-testid="selection">{selected ?? "none"}</span>
    </div>
  );
};

const meta = {
  title: "Components/MenuProvider",
  component: MenuProvider,
  tags: ["autodocs"],
  // Fully-controlled component — the stories drive it through the Harness below,
  // so these args just satisfy the (all-required) prop types.
  args: {
    children: <button>Open menu</button>,
    options,
    isOpen: false,
    activeIndex: null,
    setIsOpen: () => {},
    setActiveIndex: () => {},
    onSelect: () => {},
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof MenuProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Clicking the trigger opens the portalled option list; picking one fires `onSelect`. */
export const Default: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // floating-ui rewrites the trigger's accessible name, so match by text.
    await userEvent.click(await canvas.findByText("Open menu"));

    // Options render in a FloatingPortal, outside the canvas.
    const option = await waitFor(() => screen.getByText("Memórias Póstumas"));
    await userEvent.click(option);

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent(
        "Memórias Póstumas",
      ),
    );
  },
};
