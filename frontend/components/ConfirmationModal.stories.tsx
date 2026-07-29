import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import Button from "./Button";
import ConfirmationModal, {
  type ConfirmationModalProps,
} from "./ConfirmationModal";

// The modal is controlled (isOpen); this harness owns the flag — ignoring the
// story arg — so stories can cancel out of it and re-open it like real callers.
const Controlled = ({
  isOpen: _isOpen,
  onCancel,
  ...rest
}: ConfirmationModalProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <Button
        label="Open confirmation"
        width="fit"
        onClick={() => setIsOpen(true)}
      />
      <ConfirmationModal
        {...rest}
        isOpen={isOpen}
        onCancel={() => {
          setIsOpen(false);
          onCancel();
        }}
      />
    </>
  );
};

const meta = {
  title: "Components/Confirmation modal",
  component: ConfirmationModal,
  render: (args) => <Controlled {...args} />,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "24rem" } },
  },
  args: {
    isOpen: true,
    title: "Delete this publication?",
    message:
      "“Dom Casmurro” (1953) will be removed from the database, its index, and search results.",
    confirmLabel: "Delete",
    onConfirm: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ConfirmationModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Names the action, spells out the consequence, and waits for an explicit choice. */
export const Default: Story = {
  play: async ({ args }) => {
    const dialog = await screen.findByRole("dialog", {
      name: "Delete this publication?",
    });
    await expect(dialog).toHaveTextContent(/Dom Casmurro/);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

/** Cancelling closes the dialog without confirming anything. */
export const Cancelled: Story = {
  play: async ({ args }) => {
    await screen.findByRole("dialog", { name: "Delete this publication?" });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Delete this publication?" }),
      ).not.toBeInTheDocument(),
    );
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(args.onCancel).toHaveBeenCalled();

    // The harness can bring it back, like a caller re-opening the guard.
    await userEvent.click(
      screen.getByRole("button", { name: "Open confirmation" }),
    );
    await screen.findByRole("dialog", { name: "Delete this publication?" });
  },
};

/** While the action is in flight the confirm button shows its loading state. */
export const Loading: Story = {
  args: { loading: true },
  play: async () => {
    await screen.findByRole("dialog", { name: "Delete this publication?" });
    // The confirm button disables itself while busy; Cancel stays available.
    await expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    await expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  },
};
