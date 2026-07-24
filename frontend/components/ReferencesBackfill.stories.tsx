import type { Meta, StoryObj } from "@storybook/react";
import { RESET } from "jotai/utils";
import { Publication } from "modules/publication/model";
import {
  discardEdit,
  overrideFamily,
  publicationFamily,
  resetAll,
  setAll,
  store,
  visiblePublicationFamily,
} from "modules/publication/store";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  BackfillStep,
  ReferencesBackfillView,
  ReferencesQueue,
} from "./ReferencesBackfill";

const publication = (title: string, references: string[] = []) => ({
  ...Publication.empty(),
  title,
  authors: "Helen Caldwell",
  originalTitle: "Dom Casmurro",
  originalAuthors: "Machado de Assis",
  year: "1953",
  countries: "US",
  publishers: "Noonday Press",
  references,
});

const seedQueue = () => {
  resetAll();
  setAll([
    { id: 1, publication: publication("Dom Casmurro"), errors: null },
    {
      id: 2,
      publication: publication("The Hour of the Star", ["A source"]),
      errors: null,
    },
    { id: 3, publication: publication("The Devil to Pay"), errors: null },
  ]);
};

// The references backfill is a master-detail: a queue listbox of reference-less
// publications alongside the editor for the selected one.
const meta = {
  title: "Publications/References backfill",
  component: ReferencesBackfillView,
  args: {
    ids: [1, 2, 3],
    position: 0,
    saving: false,
    onSelect: fn(),
    onSave: fn(),
    onSkip: fn(),
  },
  beforeEach: () => seedQueue(),
  // White background: the wizard renders on the app's white Layout, so that's its
  // real contrast context (not Storybook's gray canvas).
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-white">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ReferencesBackfillView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Mimic a successful save without a server: promote the draft (base ⊕
 * override) to the stored publication and clear the edit — exactly the state
 * `update()` leaves behind. Dots and the count react to *stored* references,
 * so they only change here, never while typing. */
const persistDraft = (id: number) => {
  store.set(publicationFamily(id), store.get(visiblePublicationFamily(id)));
  store.set(overrideFamily(id), RESET);
};

/**
 * Recreates the orchestrator's local state around the presentational view, so
 * the story is fully interactive: clicking the queue moves the selection, Skip
 * discards the draft and advances, Save "persists" locally and advances.
 */
const InteractiveView: FC<ComponentProps<typeof ReferencesBackfillView>> = ({
  ids = [1, 2, 3],
  onSelect,
  onSave,
  onSkip,
}) => {
  const [position, setPosition] = useState(0);
  const advance = () =>
    setPosition((p) => Math.min(p + 1, (ids?.length ?? 1) - 1));
  const currentId = ids?.[position];

  return (
    <ReferencesBackfillView
      ids={ids}
      position={position}
      saving={false}
      onSelect={(p) => {
        onSelect(p);
        setPosition(p);
      }}
      onSave={() => {
        if (currentId !== undefined) persistDraft(currentId);
        onSave();
        advance();
      }}
      onSkip={() => {
        if (currentId !== undefined) discardEdit(currentId);
        onSkip();
        advance();
      }}
    />
  );
};

/** The whole master-detail: the queue listbox next to the editor. */
export const Populated: Story = {
  render: (args) => <InteractiveView {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("listbox")).toBeInTheDocument();
    await expect(canvas.getAllByRole("option")).toHaveLength(3);
    // The queue header counts the still-unreferenced entries (2 of the 3 seeded).
    const header = canvas.getByText("Missing references").closest("header")!;
    await expect(within(header).getByText("2")).toBeInTheDocument();
    // The first publication is selected and shown in the detail pane.
    await expect(canvas.getByText("1 / 3")).toBeInTheDocument();
    await expect(
      canvas.getByRole("option", { name: "Dom Casmurro" }),
    ).toHaveAttribute("aria-selected", "true");
    // Drafting a reference does NOT mark the publication sourced — the dot and
    // the count only react to saved references.
    await userEvent.click(
      canvas.getByRole("button", { name: "Add reference" }),
    );
    await userEvent.type(canvas.getByLabelText("Reference 1"), "A citation");
    await expect(within(header).getByText("2")).toBeInTheDocument();
    await expect(
      canvas.getByRole("option", { name: "Dom Casmurro" }),
    ).toBeInTheDocument();

    // Saving persists the draft: the dot flips, the count drops, and the
    // wizard advances.
    await userEvent.click(canvas.getByRole("button", { name: "Save & next" }));
    await expect(
      canvas.getByRole("option", { name: "Dom Casmurro — sourced" }),
    ).toBeInTheDocument();
    await expect(within(header).getByText("1")).toBeInTheDocument();
    await expect(canvas.getByText("2 / 3")).toBeInTheDocument();

    // The story is interactive: clicking a queue item moves the selection and
    // the detail pane follows.
    await userEvent.click(
      canvas.getByRole("option", { name: "The Devil to Pay" }),
    );
    await expect(
      canvas.getByRole("option", { name: "The Devil to Pay" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByText("3 / 3")).toBeInTheDocument();
  },
};

/** While the queue loads. */
export const Loading: Story = {
  args: { ids: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Finding publications/),
    ).toBeInTheDocument();
  },
};

/** Nothing left to source. */
export const Empty: Story = {
  args: { ids: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("All caught up"),
    ).toBeInTheDocument();
  },
};

/**
 * The queue listbox on its own: one tab stop, arrow keys move the selection, a
 * dot marks whether each publication is sourced.
 */
export const Queue: Story = {
  render: (args) => (
    <ReferencesQueue ids={[1, 2, 3]} activeId={1} onSelect={args.onSelect} />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("option")).toHaveLength(3);
    // The header counts only the entries still missing references (2 of 3 —
    // "The Hour of the Star" is already sourced).
    const header = canvas.getByText("Missing references").closest("header")!;
    await expect(within(header).getByText("2")).toBeInTheDocument();
    await expect(
      canvas.getByRole("option", { name: "The Hour of the Star — sourced" }),
    ).toBeInTheDocument();

    // Keyboard: focus the listbox (one tab stop) and arrow through the queue.
    const listbox = canvas.getByRole("listbox");
    listbox.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(args.onSelect).toHaveBeenCalledWith(1);

    await userEvent.keyboard("{End}");
    await expect(args.onSelect).toHaveBeenCalledWith(2);

    await userEvent.keyboard("{Home}");
    await expect(args.onSelect).toHaveBeenCalledWith(0);
  },
};

/** On the final publication there is no "next" — the action is just Save. */
export const LastStep: Story = {
  render: (args) => (
    <BackfillStep
      id={1}
      position={11}
      total={12}
      saving={false}
      onSave={args.onSave}
      onSkip={args.onSkip}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("12 / 12")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Save" })).toBeVisible();
  },
};

/**
 * The detail pane: identifying context and progress. "Save & next" is disabled
 * until a source is added (Skip moves past a publication you can't source).
 */
export const Step: Story = {
  render: (args) => (
    <BackfillStep
      id={1}
      position={0}
      total={12}
      saving={false}
      onSave={args.onSave}
      onSkip={args.onSkip}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Dom Casmurro")).toBeInTheDocument();
    await expect(canvas.getByText("1 / 12")).toBeInTheDocument();

    const save = canvas.getByRole("button", { name: "Save & next" });
    await expect(save).toBeDisabled();

    await userEvent.click(
      canvas.getByRole("button", { name: "Add reference" }),
    );
    await userEvent.type(
      canvas.getByLabelText("Reference 1"),
      "Caldwell, Helen. Introduction to Dom Casmurro.",
    );
    await expect(save).toBeEnabled();
  },
};
