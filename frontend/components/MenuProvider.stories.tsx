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
  parameters: {
    layout: "centered",
    // Floating UI's focus guards (tabindex=0 + aria-hidden) trip axe's
    // aria-hidden-focus rule as a false positive; silence just that rule for the
    // stories that leave the option list open.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
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

/**
 * Arrow keys move the highlight through the options while focus stays on the
 * trigger (floating-ui's virtual `useListNavigation`): the active option carries
 * `aria-selected`.
 */
export const HighlightsWithArrowKeys: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByText("Open menu");
    await userEvent.click(trigger);
    await screen.findByRole("listbox");

    // First Down highlights the first option; a second moves to the next.
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("option", { name: "Dom Casmurro", selected: true });

    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("option", {
      name: "Memórias Póstumas",
      selected: true,
    });
    await expect(
      screen.getByRole("option", { name: "Dom Casmurro" }),
    ).toHaveAttribute("aria-selected", "false");

    // Virtual navigation (FloatingFocusManager initialFocus=-1): focus stays on
    // the trigger and the active option is tracked via aria, never moved to the
    // list.
    await expect(trigger).toHaveFocus();
  },
};

/** Escape dismisses the option list (`useDismiss`). */
export const DismissesOnEscape: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Open menu"));
    await screen.findByRole("listbox");

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  },
};

/** A pointer press outside the trigger and list dismisses it (`useDismiss`). */
export const DismissesOnOutsideClick: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Open menu"));
    await screen.findByRole("listbox");

    await userEvent.click(document.body);
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  },
};
