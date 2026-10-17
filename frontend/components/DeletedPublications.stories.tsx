import type { Meta, StoryObj } from "@storybook/react";
import { Publication } from "modules/publication/model";
import type { DeletedPublicationEntry } from "modules/publication/model";
import type { Restoration } from "modules/publication/remote";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import DeletedPublications from "./DeletedPublications";

const ENTRIES: DeletedPublicationEntry[] = [
  {
    publication: {
      ...Publication.empty(),
      id: 1,
      title: "Dom Casmurro",
      authors: ["Helen Caldwell"],
      year: "1953",
      publishers: ["Noonday Press"],
    },
    deletedAt: "2026-07-20T09:00:00",
  },
  {
    publication: {
      ...Publication.empty(),
      id: 2,
      title: "Iraçéma the Honey-Lips",
      authors: ["Isabel Burton"],
      year: "1886",
      publishers: ["Bickers & Son"],
    },
    deletedAt: "2026-07-24T16:00:00",
  },
];

// The record imported again while the first "Dom Casmurro" was deleted.
const TWIN = {
  ...ENTRIES[0].publication,
  id: 3,
  originalTitle: "Dom Casmurro",
  originalAuthors: ["Machado de Assis"],
  countries: ["US"],
};

// Returns a mock of a restore that another publication refuses, as `TWIN`
// refuses the first "Dom Casmurro". Each story makes its own, so the calls
// it counts are its own.
const refused = () =>
  fn(async (): Promise<Restoration> => ({ outcome: "identical", twin: TWIN }));

/**
 * Presses Restore on the first entry, whose restore the story refuses, and
 * returns the Year field of the dialog that offers to restore it with changes.
 */
async function offerChanges() {
  await userEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]);
  const dialog = await screen.findByRole("dialog", {
    name: "Another publication is identical to this one",
  });

  return within(dialog).getByRole("textbox", { name: "Year" });
}

/** Returns the confirmation that asks whether to discard a change, once open. */
const discardConfirmation = () =>
  screen.findByRole("dialog", { name: "Discard your changes?" });

/** Waits until no dialog is open. */
const allClosed = () =>
  waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

const meta = {
  title: "Publications/Deleted publications",
  component: DeletedPublications,
  args: {
    entries: ENTRIES,
    onRestore: fn(async (): Promise<Restoration> => ({ outcome: "restored" })),
  },
} satisfies Meta<typeof DeletedPublications>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each tombstone shows what it was and when it left, with a one-click restore. */
export const Default: Story = {
  play: async ({ args }) => {
    await expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();
    await expect(screen.getByText(/Deleted Jul 20, 2026/)).toBeInTheDocument();

    // Restore is non-destructive — a single click, no confirmation gate.
    const restores = screen.getAllByRole("button", { name: "Restore" });
    await expect(restores).toHaveLength(2);
    await userEvent.click(restores[0]);
    await expect(args.onRestore).toHaveBeenCalledWith(1);
  },
};

// Settles the restore that `Restoring` holds in flight.
let settleRestoring = () => {};

/**
 * While one restore is in flight only that row shows it, and a second row
 * cannot start one. The list owns this state, so it is reached by clicking
 * rather than by setting a prop.
 *
 * The restore stays in flight until the story ends, and settles then. React
 * keeps every transition pending while one async transition is unsettled, so
 * a restore that never settled would leave the restores of later stories
 * pending, and their Restore buttons disabled.
 */
export const Restoring: Story = {
  args: {
    onRestore: fn(
      () =>
        new Promise<Restoration>((resolve) => {
          settleRestoring = () => resolve({ outcome: "restored" });
        }),
    ),
  },
  beforeEach: () => () => settleRestoring(),
  play: async ({ args }) => {
    const [first, second] = screen.getAllByRole("button", { name: "Restore" });
    await expect(second).toBeEnabled();

    await userEvent.click(first);

    await expect(first).toBeDisabled();
    await expect(second).toBeDisabled();
    await expect(args.onRestore).toHaveBeenCalledTimes(1);
  },
};

/**
 * A restore refused because another publication has the same identity opens a
 * dialog. It shows that publication, and the deleted one's edit form, which
 * starts with the conflict as its error, so it cannot be restored unchanged.
 */
export const WhenAnIdenticalOneExists: Story = {
  args: {
    onRestore: fn(async (): Promise<Restoration> => ({
      outcome: "identical",
      twin: TWIN,
    })),
  },
  play: async ({ args }) => {
    await userEvent.click(
      screen.getAllByRole("button", { name: "Restore" })[0],
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Another publication is identical to this one",
    });
    await expect(args.onRestore).toHaveBeenCalledWith(1);

    // The identical publication links to its own page.
    await expect(
      within(dialog).getByRole("link", { name: "Open this record" }),
    ).toHaveAttribute("href", expect.stringMatching(/\/publications\/3$/));

    // The deleted publication's fields can be changed, and it cannot be
    // restored as it is.
    await expect(
      within(dialog).getByRole("textbox", { name: "Year" }),
    ).toHaveValue("1953");
    await expect(
      within(dialog).getByRole("button", {
        name: "Restore with these changes",
      }),
    ).toBeDisabled();
  },
};

/**
 * With nothing changed, the dialog that offers to restore with changes closes
 * at once. The play test opens it and presses Escape, and checks that it closed
 * without asking and that nothing was restored with changes.
 */
export const ClosingTheOffer: Story = {
  args: { onRestore: refused() },
  play: async ({ args }) => {
    await offerChanges();

    await userEvent.keyboard("{Escape}");

    await allClosed();
    await expect(args.onRestore).toHaveBeenCalledTimes(1);
    await expect(args.onRestore).toHaveBeenCalledWith(1);
  },
};

/**
 * Closing the dialog with a change asks first, and backing out keeps the
 * change. The play test steps the year up and presses Escape, then cancels the
 * confirmation, and checks that the field keeps the new year.
 */
export const KeepingAChange: Story = {
  args: { onRestore: refused() },
  play: async () => {
    const year = await offerChanges();
    await userEvent.type(year, "{ArrowUp}");
    await expect(year).toHaveValue("1954");

    await userEvent.keyboard("{Escape}");
    await expect(await discardConfirmation()).toHaveTextContent(
      "Your changes to this publication have not been saved.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Discard your changes?" }),
      ).not.toBeInTheDocument(),
    );
    await expect(year).toHaveValue("1954");
  },
};

/**
 * Discard closes the dialog and drops the change, and restores nothing. The
 * play test steps the year up, presses Escape and confirms the discard, then
 * presses Restore again and checks that the new dialog starts from the deleted
 * publication's year.
 */
export const DiscardingAChange: Story = {
  args: { onRestore: refused() },
  play: async ({ args }) => {
    const year = await offerChanges();
    await userEvent.type(year, "{ArrowUp}");
    await expect(year).toHaveValue("1954");

    await userEvent.keyboard("{Escape}");
    await discardConfirmation();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    await allClosed();
    await expect(args.onRestore).toHaveBeenCalledTimes(1);

    await expect(await offerChanges()).toHaveValue("1953");
  },
};

/** An empty trash says so. */
export const Empty: Story = {
  args: { entries: [] },
  play: async () => {
    await expect(
      screen.getByText(/no publication is currently deleted/),
    ).toBeInTheDocument();
  },
};
