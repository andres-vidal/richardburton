import type { Meta, StoryObj } from "@storybook/react";
import type { Distinction, DuplicateCluster } from "app/publications/read";
import { empty, type Publication } from "modules/publication/model";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { DuplicateReviewView } from "./DuplicateReview";

const publication = (fields: Partial<Publication>): Publication => ({
  ...empty(),
  title: "Dom Casmurro",
  originalTitle: "Dom Casmurro",
  originalAuthors: "Machado de Assis",
  authors: "Helen Caldwell",
  year: "1953",
  countries: "US",
  publishers: "Noonday Press",
  ...fields,
});

// Two questions: a title typed twice with a typo, and the same translator's
// work entered again under the title of a later printing.
const CLUSTERS: DuplicateCluster[] = [
  {
    score: 0.79,
    publications: [
      publication({ id: 1, references: ["Caldwell, Helen. Introduction."] }),
      publication({
        id: 2,
        title: "Dom Casmuro",
        publishers: "W. H. Allen",
        countries: "GB",
      }),
    ],
  },
  {
    score: 0.42,
    publications: [
      publication({ id: 3, title: "Iraçéma the Honey-Lips", year: "1886" }),
      publication({
        id: 4,
        title: "Iracema, the Honey-Lips: A Legend",
        year: "1887",
      }),
    ],
  },
];

// A pair the reviewer has already ruled apart — the same records, on the other
// side of the answer.
const RULED_APART: Distinction[] = [
  {
    publications: [
      publication({ id: 5, title: "Iracema", year: "1886" }),
      publication({ id: 6, title: "Iracema", year: "1922" }),
    ],
    actor: "curator@rb.test",
    timestamp: "2026-08-01T10:00:00",
  },
];

// The view is presentational; this harness owns the position so the stories can
// move through the queue like the page does.
const Stepping = (
  args: Omit<
    Parameters<typeof DuplicateReviewView>[0],
    "position" | "onSelect"
  >,
) => {
  const [position, setPosition] = useState(0);

  return (
    <DuplicateReviewView {...args} position={position} onSelect={setPosition} />
  );
};

const meta = {
  title: "Publications/Duplicate review",
  component: DuplicateReviewView,
  render: (args) => <Stepping {...args} />,
  args: {
    clusters: CLUSTERS,
    distinctions: [],
    position: 0,
    busy: false,
    onSelect: fn(),
    onMerge: fn(),
    onDistinguish: fn(),
    onReconsider: fn(),
    onSkip: fn(),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DuplicateReviewView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The evidence side by side, with the first record kept unless told otherwise. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("listbox")).toBeVisible();
    await expect(canvas.getAllByRole("option")).toHaveLength(2);

    // Everything a reviewer needs to tell the two apart is on the page.
    await expect(canvas.getByText("W. H. Allen")).toBeVisible();
    await expect(
      canvas.getByText("Caldwell, Helen. Introduction."),
    ).toBeVisible();

    await expect(
      canvas.getByRole("radio", { name: "Keep Dom Casmurro" }),
    ).toBeChecked();
  },
};

/** Which record survives is the reviewer's to choose before merging. */
export const KeepingTheOther: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("radio", { name: "Keep Dom Casmuro" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Merge into the selected one" }),
    );

    await expect(args.onMerge).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
    );
  },
};

/** Saying they are different records the answer, so it is never asked again. */
export const NotDuplicates: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Not duplicates" }),
    );

    await expect(args.onDistinguish).toHaveBeenCalled();
    await expect(args.onMerge).not.toHaveBeenCalled();
  },
};

/** The queue moves by arrow keys as well as by click. */
export const SteppingThroughTheQueue: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getAllByRole("option")[1]);
    await waitFor(async () =>
      expect(
        canvas.getByRole("radio", { name: "Keep Iraçéma the Honey-Lips" }),
      ).toBeVisible(),
    );

    canvas.getByRole("listbox").focus();
    await userEvent.keyboard("{ArrowUp}");
    await waitFor(async () =>
      expect(
        canvas.getByRole("radio", { name: "Keep Dom Casmurro" }),
      ).toBeVisible(),
    );
  },
};

/** Nothing alike left: the review says so rather than showing an empty frame. */
export const NothingToReconcile: Story = {
  args: { clusters: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Nothing to reconcile"),
    ).toBeVisible();
  },
};

/** While an answer is in flight the destructive action shows it and refuses a second click. */
export const Answering: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("button", { name: "Merge into the selected one" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Not duplicates" }),
    ).toBeDisabled();
    // Skipping costs nothing and stays available.
    await expect(canvas.getByRole("button", { name: "Skip" })).toBeEnabled();
  },
};

/**
 * A decision already made, and the way out of it. The section is collapsed —
 * it is the exception, not the work — and opening it offers each pair back.
 */
export const RuledApart: Story = {
  args: { distinctions: RULED_APART },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Collapsed: the count is on the summary, the pair is not on screen yet.
    const summary = canvas.getByText("Ruled apart (1)");
    await expect(summary).toBeVisible();

    await userEvent.click(summary);

    await expect(
      canvas.getByText(/Told apart by curator@rb.test/),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reconsider" }));

    await expect(args.onReconsider).toHaveBeenCalledWith(RULED_APART[0]);
  },
};

/** With nothing ruled apart there is nothing to offer back, and no empty section. */
export const NothingRuledApart: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText(/Ruled apart/),
    ).not.toBeInTheDocument();
  },
};
