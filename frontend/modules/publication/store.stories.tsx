import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "jotai";
import { FC } from "react";
import { expect, waitFor, within } from "storybook/test";

import { PublicationError, PublicationId, empty } from "./model";
import {
  DRAFT_ID,
  addNew,
  createId,
  overrideField,
  resetAll,
  setAll,
  setDeleted,
  store,
} from "./store";
import {
  useIsPublicationValid,
  usePublicationField,
  useValidPublicationCount,
  useVisiblePublicationIds,
} from "./hooks";

// A minimal harness that surfaces the store's derived state as text, so the
// play function can drive the imperative actions and assert the hooks react.
// The decorator provides the same module `store` the actions write to, so
// reads and writes stay in sync; `resetAll()` gives each run a clean slate.

const Row: FC<{ id: PublicationId }> = ({ id }) => {
  const title = usePublicationField(id, "title");
  const valid = useIsPublicationValid(id);
  return (
    <li data-testid={`row-${id}`} data-valid={valid}>
      #{id} — {title || "(untitled)"} {valid ? "✓" : "✕"}
    </li>
  );
};

const Harness: FC = () => {
  const ids = useVisiblePublicationIds();
  const validCount = useValidPublicationCount();
  return (
    <div className="space-y-2 text-sm">
      <div data-testid="ids">ids: {ids?.join(", ") ?? "—"}</div>
      <div data-testid="valid-count">valid: {validCount}</div>
      <ul className="space-y-1">
        {ids?.map((id) => <Row key={id} id={id} />)}
      </ul>
    </div>
  );
};

const entry = (
  id: PublicationId,
  title: string,
  errors: PublicationError = null,
) => ({ id, publication: { ...empty(), title }, errors });

const meta = {
  title: "Internal/Publication store",
  component: Harness,
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Reactivity: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Seed two rows (ids from the shared counter, as the remote layer will),
    // one of them invalid.
    resetAll();
    const id1 = createId();
    const id2 = createId();
    setAll([
      entry(id1, "Dom Casmurro"),
      entry(id2, "The Hour of the Star", "conflict"),
    ]);

    await waitFor(() =>
      expect(canvas.getByTestId("ids")).toHaveTextContent(`ids: ${id1}, ${id2}`),
    );
    // Only the error-free row counts as valid.
    expect(canvas.getByTestId("valid-count")).toHaveTextContent("valid: 1");
    expect(canvas.getByTestId(`row-${id1}`)).toHaveAttribute(
      "data-valid",
      "true",
    );
    expect(canvas.getByTestId(`row-${id2}`)).toHaveAttribute(
      "data-valid",
      "false",
    );

    // An override merges over the base value and the cell reacts.
    overrideField(id1, "title", "Memórias Póstumas");
    await waitFor(() =>
      expect(canvas.getByTestId(`row-${id1}`)).toHaveTextContent(
        "Memórias Póstumas",
      ),
    );

    // Deleting hides the row from the visible set.
    setDeleted([id2]);
    await waitFor(() =>
      expect(canvas.getByTestId("ids")).toHaveTextContent(`ids: ${id1}`),
    );
    expect(canvas.queryByTestId(`row-${id2}`)).toBeNull();

    // The draft registers as a fresh, stable id (no collision) and clears itself.
    overrideField(DRAFT_ID, "title", "Grande Sertão: Veredas");
    const newId = addNew();
    await waitFor(() =>
      expect(canvas.getByTestId(`row-${newId}`)).toHaveTextContent(
        "Grande Sertão: Veredas",
      ),
    );
    expect(newId).not.toBe(id1);
    expect(newId).not.toBe(DRAFT_ID);
  },
};
