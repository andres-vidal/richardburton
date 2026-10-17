import type { Meta, StoryObj } from "@storybook/react";
import { usePublicationField } from "modules/publication/hooks";
import { Publication } from "modules/publication/model";
import {
  discardEdit,
  publicationFamily,
  remember,
  resetAll,
} from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { store } from "modules/store";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Button from "./Button";
import DataInput from "./DataInput";
import EditModal from "./EditModal";
import { useModal } from "./Modal";

// The saved publication the stories edit, row 1 of the story's store.
const RECORD = {
  ...Publication.empty(),
  id: 1,
  title: "Dom Casmurro",
  year: "1953",
};

/** The title field of row 1, which writes each change to the row. */
const TitleField = () => {
  const title = usePublicationField(1, "title");

  return (
    <DataInput
      rowId={1}
      colId="title"
      value={title}
      error=""
      aria-label="Title"
      errorDisplay="inline"
    />
  );
};

/**
 * A button that opens an `EditModal` with the title field of row 1 in it.
 * Closing the modal drops any edit of the row with `discardEdit`, as
 * `EditModal` asks of `onClose`.
 */
const EditingTheTitle = () => {
  const modal = useModal();
  const edits = usePublicationStore();

  function close() {
    discardEdit(edits, 1);
    modal.close();
  }

  return (
    <div className="p-8">
      <Button label="Edit the title" width="fit" onClick={modal.open} />
      <EditModal isOpen={modal.isOpen} onClose={close} heading="Edit the title">
        <TitleField />
      </EditModal>
    </div>
  );
};

/** Fills the story's store with the saved `RECORD` and nothing else. */
function seed() {
  resetAll(store);
  remember(store, RECORD);
}

/** Opens the modal and returns its title field. */
async function open(canvasElement: HTMLElement) {
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Edit the title" }),
  );

  return screen.findByRole("textbox", { name: "Title" });
}

/** Returns the confirmation that asks whether to discard the edit, once open. */
const confirmation = () =>
  screen.findByRole("dialog", { name: "Discard your changes?" });

/** Waits until the confirmation has closed. */
const confirmationClosed = () =>
  waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Discard your changes?" }),
    ).not.toBeInTheDocument(),
  );

const meta = {
  title: "Publications/Edit modal",
  component: EditModal,
  args: { isOpen: false, onClose: () => {}, label: "Edit" },
  render: () => <EditingTheTitle />,
  beforeEach: seed,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "28rem" } },
  },
} satisfies Meta<typeof EditModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * With nothing changed, the modal closes at once. The play test opens it,
 * presses Escape, and checks that it closed without asking.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await open(canvasElement);

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};

/**
 * Closing the modal with an unsaved edit asks first, and backing out keeps the
 * edit. The play test changes the title and presses Escape, then cancels the
 * confirmation with its Cancel button, and the second time with Escape. Each
 * time the field keeps the typed title.
 */
export const KeepingAnEdit: Story = {
  play: async ({ canvasElement }) => {
    const title = await open(canvasElement);
    await userEvent.type(title, " (revised)");

    await userEvent.keyboard("{Escape}");
    await expect(await confirmation()).toHaveTextContent(
      "Your changes to this publication have not been saved.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await confirmationClosed();
    await expect(title).toHaveValue("Dom Casmurro (revised)");

    await userEvent.keyboard("{Escape}");
    await confirmation();
    await userEvent.keyboard("{Escape}");
    await confirmationClosed();
    await expect(title).toHaveValue("Dom Casmurro (revised)");
    await expect(
      screen.getByRole("dialog", { name: "Edit the title" }),
    ).toBeInTheDocument();
  },
};

/**
 * Discard closes the modal, and the edit goes with it. The play test changes
 * the title, presses Escape and confirms the discard, and checks that the
 * modal closed and that the row is back to its saved title.
 */
export const DiscardingAnEdit: Story = {
  play: async ({ canvasElement }) => {
    const title = await open(canvasElement);
    await userEvent.type(title, " (revised)");

    await userEvent.keyboard("{Escape}");
    await confirmation();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(store.get(publicationFamily(1))?.title).toBe("Dom Casmurro");
  },
};
