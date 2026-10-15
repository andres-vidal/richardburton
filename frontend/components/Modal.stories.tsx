import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Button from "./Button";
import { Modal } from "./Modal";

const LINES = Array.from(
  { length: 30 },
  (_, i) => `Row ${i + 1} cannot be inserted until it is corrected.`,
);

const meta = {
  title: "Components/Modal",
  component: Modal,
  args: { isOpen: false, onClose: () => {}, label: "Dialog" },
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "28rem" } },
  },
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A button that opens a modal with a heading, and the modal it opens. */
const OpenableModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <Button label="Open modal" width="fit" onClick={() => setIsOpen(true)} />
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        heading="Modal title"
      >
        <p>This content lives inside the dialog, rendered in a portal.</p>
      </Modal>
    </div>
  );
};

/**
 * A dialog that renders in a portal over a dimmed overlay. The play test opens
 * it, checks that its heading names it, and closes it with Escape.
 */
export const Default: Story = {
  render: () => <OpenableModal />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Open modal" }),
    );
    await screen.findByRole("dialog", { name: "Modal title" });

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};

/**
 * A `heading` with a `subheading` and an `aside`, over content long enough to
 * scroll. The heading stays pinned at the top of the dialog while the content
 * scrolls under it. The play test checks that the heading is the dialog's `h1`
 * and names the dialog.
 */
export const WithAHeading: Story = {
  render: () => (
    <Modal
      isOpen
      onClose={() => {}}
      heading="What is wrong with these rows"
      subheading="30 rows cannot be inserted until they are corrected."
      aside="1 / 3"
    >
      <ul className="space-y-3 text-sm text-gray-700">
        {LINES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Modal>
  ),
  play: async () => {
    const dialog = await screen.findByRole("dialog", {
      name: "What is wrong with these rows",
    });

    await expect(
      within(dialog).getByRole("heading", { level: 1 }),
    ).toHaveTextContent("What is wrong with these rows");
    await expect(within(dialog).getByText("1 / 3")).toBeVisible();
  },
};

/**
 * Without a heading, the children fill the dialog as they are, and `label`
 * names the dialog. The play test checks the name.
 */
export const WithoutAHeading: Story = {
  args: { isOpen: true, label: "Publication details" },
  render: (args) => (
    <Modal {...args}>
      <p className="p-8">Content that brings its own padding and heading.</p>
    </Modal>
  ),
  play: async () => {
    await expect(
      await screen.findByRole("dialog", { name: "Publication details" }),
    ).toHaveTextContent("Content that brings its own padding and heading.");
  },
};
