import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import { Modal } from "./Modal";

const meta = {
  title: "Components/Modal",
  component: Modal,
  tags: ["autodocs"],
  args: { isOpen: false, onClose: () => {} },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A dialog that renders in a portal over a dimmed overlay. Open it, then close
 * it by pressing Escape.
 */
// A trigger + local open state so the story exercises the open/close flow.
const OpenableModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <button
        className="px-3 py-1 rounded border"
        onClick={() => setIsOpen(true)}
      >
        Open modal
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="p-8">
          <h2 className="text-lg font-semibold">Modal title</h2>
          <p className="mt-2">
            This content lives inside the dialog, rendered in a portal.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export const Default: Story = {
  render: () => <OpenableModal />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The dialog is portalled, so its content is queried from the whole screen.
    await userEvent.click(canvas.getByRole("button", { name: "Open modal" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await expect(screen.getByText("Modal title")).toBeInTheDocument();

    // Escape closes it (framer-motion exit animation removes it async).
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};

/** The open dialog in isolation — useful for reviewing its content layout. */
export const Open: Story = {
  args: { isOpen: true, onClose: () => {} },
  // Portalled full-screen dialog — render it bounded on the docs page.
  parameters: { docs: { story: { inline: false, height: "24rem" } } },
  render: (args) => (
    <Modal {...args}>
      <div className="p-8">
        <h2 className="text-lg font-semibold">Always open</h2>
        <p className="mt-2">Handy for iterating on the dialog body.</p>
      </div>
    </Modal>
  ),
  play: async () => {
    // Content is portalled; assert against the whole screen.
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await expect(screen.getByText("Always open")).toBeInTheDocument();
  },
};
