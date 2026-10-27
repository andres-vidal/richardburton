import type { Meta, StoryObj } from "@storybook/react";
import type { Source } from "modules/publication/model";
import { FC, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { source } from "test/publication-fixtures";
import { installFakeTranslator } from "test/translator";

import SourcesEditor from "./SourcesEditor";

// SourcesEditor is controlled — every add/remove/reorder/edit emits a new
// list — so hold `value` in state, otherwise the canvas would never reflect an
// interaction. onChange is still forwarded so `fn()` assertions keep working.
const Controlled: FC<{
  value?: Source[];
  onChange?: (sources: Source[]) => void;
  error?: string;
}> = ({ value: initial = [], onChange, error }) => {
  const [value, setValue] = useState(initial);

  return (
    <SourcesEditor
      value={value}
      error={error}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const meta = {
  title: "Publications/Sources editor",
  component: SourcesEditor,
  args: { value: [], onChange: fn() },
  render: (args) => (
    <Controlled
      value={args.value}
      onChange={args.onChange}
      error={args.error}
    />
  ),
  decorators: [
    // White background: the editor lives in the (white) edit modal, so this is
    // its real contrast context.
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white rounded-lg border border-gray-200">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof SourcesEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Returns the tab named `name` in the editor's tab list. */
const tab = (canvas: ReturnType<typeof within>, name: string) =>
  within(
    canvas.getByRole("tablist", { name: "Language of the sources" }),
  ).getByRole("tab", { name });

/**
 * Fully interactive: add a row, type into it, reorder it, then remove it — the
 * list updates live, mirroring the edit form. Start with one source so the
 * populated shape is visible before touching anything. The English tab is
 * selected, the reader's language.
 */
export const Default: Story = {
  args: {
    value: [
      source(
        null,
        "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
      ),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Add a second source and type into it — the new row reflects the input.
    await userEvent.click(canvas.getByRole("button", { name: "Add source" }));
    const second = canvas.getByLabelText("Source 2");
    await userEvent.type(second, "https://archive.org/details/domcasmurro");
    await expect(second).toHaveValue("https://archive.org/details/domcasmurro");

    // Reorder: move the new row up; it becomes Source 1.
    await userEvent.click(
      canvas.getByRole("button", { name: "Move source 2 up" }),
    );
    await expect(canvas.getByLabelText("Source 1")).toHaveValue(
      "https://archive.org/details/domcasmurro",
    );

    // Remove it; the original returns as the sole row.
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove source 1" }),
    );
    await expect(canvas.getByLabelText("Source 1")).toHaveValue(
      "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
    );
    await expect(canvas.queryByLabelText("Source 2")).not.toBeInTheDocument();
  },
};

/** No sources yet — an empty state and the add control. */
export const Empty: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No sources yet.")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Add source" }));
    await expect(args.onChange).toHaveBeenCalledWith([source(null, null)]);
  },
};

/** A populated list: one input per entry, with reorder + remove controls. */
export const WithSources: Story = {
  args: {
    value: [
      source(
        null,
        "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
      ),
      source(null, "https://archive.org/details/domcasmurro0000mach"),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Source 1")).toHaveValue(
      "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
    );
    // The first row cannot move up; the last cannot move down.
    await expect(
      canvas.getByRole("button", { name: "Move source 1 up" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Move source 2 down" }),
    ).toBeDisabled();
  },
};

/**
 * The same sources in both languages: each tab lists every source, with its
 * text in that tab's language, and a source with no text in that language
 * shows its text in the other one as the placeholder. The play test types the
 * missing English text of the second source, then checks the Portuguese tab.
 */
export const InBothLanguages: Story = {
  args: {
    value: [
      source(
        "Caldwell, Helen. Introdução a Dom Casmurro, 1953.",
        "Caldwell, Helen. Introduction to Dom Casmurro, 1953.",
      ),
      source("Sousa, J. Galante de. Bibliografia de Machado de Assis, 1955."),
    ],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const second = canvas.getByLabelText("Source 2");

    await expect(second).toHaveValue("");
    await expect(second).toHaveAttribute(
      "placeholder",
      "Sousa, J. Galante de. Bibliografia de Machado de Assis, 1955.",
    );
    await userEvent.type(second, "Sousa. A bibliography of Machado de Assis.");
    await expect(args.onChange).toHaveBeenLastCalledWith([
      source(
        "Caldwell, Helen. Introdução a Dom Casmurro, 1953.",
        "Caldwell, Helen. Introduction to Dom Casmurro, 1953.",
      ),
      source(
        "Sousa, J. Galante de. Bibliografia de Machado de Assis, 1955.",
        "Sousa. A bibliography of Machado de Assis.",
      ),
    ]);

    await userEvent.click(tab(canvas, "Português"));
    await expect(canvas.getByLabelText("Source 1")).toHaveValue(
      "Caldwell, Helen. Introdução a Dom Casmurro, 1953.",
    );
  },
};

/** Reordering swaps adjacent entries on screen — moving row 2 up swaps the two. */
export const Reorder: Story = {
  args: {
    value: [source("Primeira fonte", "First source"), source(null, "Second")],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Source 1")).toHaveValue("First source");
    await expect(canvas.getByLabelText("Source 2")).toHaveValue("Second");

    await userEvent.click(
      canvas.getByRole("button", { name: "Move source 2 up" }),
    );

    // The rows have actually swapped, in both languages.
    await expect(canvas.getByLabelText("Source 1")).toHaveValue("Second");
    await expect(canvas.getByLabelText("Source 2")).toHaveValue("First source");
    await userEvent.click(tab(canvas, "Português"));
    await expect(canvas.getByLabelText("Source 2")).toHaveValue(
      "Primeira fonte",
    );
  },
};

/** Removing an entry drops its row, leaving the rest. */
export const Remove: Story = {
  args: {
    value: [source(null, "First source"), source(null, "Second source")],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("textbox")).toHaveLength(2);

    await userEvent.click(
      canvas.getByRole("button", { name: "Remove source 1" }),
    );

    // The first row is gone; the second is now the sole row.
    await expect(canvas.getByLabelText("Source 1")).toHaveValue(
      "Second source",
    );
    await expect(canvas.queryByLabelText("Source 2")).not.toBeInTheDocument();
  },
};

/**
 * In a browser that can translate, here with the fake Translator API, the
 * English tab drafts the English text of each source that has none from its
 * Portuguese text, and leaves the source that has one alone. The tab then
 * asks to check the titles. The play test drafts and checks the list.
 */
export const DraftedFromPortuguese: Story = {
  args: {
    value: [
      source("Caldwell, Helen. Introdução, 1953.", "Caldwell. Introduction."),
      source("Sousa, J. Galante de. Bibliografia, 1955."),
    ],
  },
  beforeEach: installFakeTranslator,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Draft the sources from Portuguese",
      }),
    );

    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith([
        source("Caldwell, Helen. Introdução, 1953.", "Caldwell. Introduction."),
        source(
          "Sousa, J. Galante de. Bibliografia, 1955.",
          "[en] Sousa, J. Galante de. Bibliografia, 1955.",
        ),
      ]),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      /Check the titles/,
    );
  },
};

/** An error with the sources, such as a file that could not pair them. */
export const WithError: Story = {
  args: {
    value: [source("Uma fonte")],
    error:
      "The sources in Portuguese and in English have different numbers of lines, so they cannot be paired",
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/different numbers of lines/),
    ).toBeVisible();
  },
};
