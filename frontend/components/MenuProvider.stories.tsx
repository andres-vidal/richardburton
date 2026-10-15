import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Button from "./Button";
import MenuProvider, { MenuOption } from "./MenuProvider";

const options: MenuOption[] = [
  { id: "1", label: "Dom Casmurro" },
  { id: "2", label: "Memórias Póstumas" },
  { id: "3", label: "Quincas Borba" },
];

/**
 * Keeps the open state, the highlighted option and the picked option, which
 * `MenuProvider` leaves to its caller, and shows the picked option's label.
 */
const Harness = ({ bordered }: { bordered?: boolean }) => {
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
        bordered={bordered}
      >
        <Button
          label="Open menu"
          aria-label="Open menu"
          variant="outline"
          width="fit"
          onClick={() => setIsOpen(!isOpen)}
        />
      </MenuProvider>
      <span data-testid="selection">{selected ?? "none"}</span>
    </div>
  );
};

const meta = {
  title: "Components/MenuProvider",
  component: MenuProvider,
  // The stories render the harness, so these args only satisfy the props.
  args: {
    children: <Button label="Open menu" />,
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

/**
 * Clicking the trigger opens the list in a portal, and picking an option calls
 * `onSelect` with it. The play test picks one and checks the selection.
 */
export const Default: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("combobox", { name: "Open menu" }),
    );

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
    const trigger = await canvas.findByRole("combobox", { name: "Open menu" });
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

/** `bordered` draws the list outlined, to match a bordered input. */
export const Bordered: Story = {
  render: () => <Harness bordered />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("combobox", { name: "Open menu" }),
    );
    const listbox = await screen.findByRole("listbox");
    await expect(getComputedStyle(listbox).borderTopWidth).toBe("1px");
  },
};

/** Escape dismisses the option list (`useDismiss`). */
export const DismissesOnEscape: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("combobox", { name: "Open menu" }),
    );
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
    await userEvent.click(
      await canvas.findByRole("combobox", { name: "Open menu" }),
    );
    await screen.findByRole("listbox");

    await userEvent.click(document.body);
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  },
};
