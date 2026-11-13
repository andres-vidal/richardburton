import type { Meta, StoryObj } from "@storybook/react";
import type { Language } from "modules/publication/model";
import { FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { installFakeTranslator } from "test/translator";

import SourcesEditor from "./SourcesEditor";

type Sources = Record<Language, string[]>;

// SourcesEditor is controlled — every add/remove/reorder/edit emits a new
// list — so hold `value` in state, otherwise the canvas would never reflect an
// interaction. onChange is still forwarded so `fn()` assertions keep working.
const Controlled: FC<{
  value: Sources;
  onChange: (language: Language, sources: string[]) => void;
  errors?: Partial<Record<Language, string>>;
}> = ({ value: initial, onChange, errors }) => {
  const [value, setValue] = useState(initial);

  return (
    <SourcesEditor
      value={value}
      errors={errors}
      onChange={(language, next) => {
        setValue((before) => ({ ...before, [language]: next }));
        onChange(language, next);
      }}
    />
  );
};

const meta = {
  title: "Publications/Sources editor",
  component: SourcesEditor,
  args: { value: { pt: [], en: [] }, onChange: fn() },
  render: (args) => (
    <Controlled
      value={args.value}
      onChange={args.onChange}
      errors={args.errors}
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

/** Returns queries within the panel of the tab named `name`. */
const panel = (
  canvas: ReturnType<typeof within>,
  name: "English" | "Português",
) => within(canvas.getByRole("tabpanel", { name }));

/** Returns the tab named `name` in the editor's tab list. */
const tab = (canvas: ReturnType<typeof within>, name: string) =>
  within(
    canvas.getByRole("tablist", { name: "Language of the sources" }),
  ).getByRole("tab", { name });

/**
 * Fully interactive: add a row, type into it, reorder it, then remove it — the
 * list updates live, mirroring the edit form. It starts with one source in
 * English so the populated shape is visible before touching anything. The
 * English tab is selected, the reader's language.
 */
export const Default: Story = {
  args: {
    value: {
      pt: [],
      en: [
        "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const english = panel(canvas, "English");

    // Add a second source and type into it — the new row reflects the input.
    await userEvent.click(english.getByRole("button", { name: "Add source" }));
    const second = english.getByLabelText("Source 2");
    await userEvent.type(second, "https://archive.org/details/domcasmurro");
    await expect(second).toHaveValue("https://archive.org/details/domcasmurro");

    // Reorder: move the new row up; it becomes Source 1.
    await userEvent.click(
      english.getByRole("button", { name: "Move source 2 up" }),
    );
    await expect(english.getByLabelText("Source 1")).toHaveValue(
      "https://archive.org/details/domcasmurro",
    );

    // Remove it; the original returns as the sole row.
    await userEvent.click(
      english.getByRole("button", { name: "Remove source 1" }),
    );
    await expect(english.getByLabelText("Source 1")).toHaveValue(
      "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
    );
    await expect(english.queryByLabelText("Source 2")).not.toBeInTheDocument();
  },
};

/**
 * No sources yet — an empty state and the add control. The play test adds a
 * source and checks that it is added to the English list.
 */
export const Empty: Story = {
  play: async ({ args, canvasElement }) => {
    const english = panel(within(canvasElement), "English");
    await expect(english.getByText("No sources yet.")).toBeInTheDocument();

    await userEvent.click(english.getByRole("button", { name: "Add source" }));
    await expect(args.onChange).toHaveBeenCalledWith("en", [""]);
  },
};

/**
 * A populated list: one input per entry, with reorder and remove controls. The
 * play test checks that the first row cannot move up and the last cannot move
 * down.
 */
export const WithSources: Story = {
  args: {
    value: {
      pt: [],
      en: [
        "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
        "https://archive.org/details/domcasmurro0000mach",
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const english = panel(within(canvasElement), "English");
    await expect(english.getByLabelText("Source 1")).toHaveValue(
      "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
    );
    await expect(
      english.getByRole("button", { name: "Move source 1 up" }),
    ).toBeDisabled();
    await expect(
      english.getByRole("button", { name: "Move source 2 down" }),
    ).toBeDisabled();
  },
};

/**
 * Sources in both languages: each tab lists its own sources, which need not
 * match the other tab's. The play test adds an English source, then checks
 * that the Portuguese tab still lists only its own.
 */
export const InBothLanguages: Story = {
  args: {
    value: {
      pt: [
        "Caldwell, Helen. Introdução a Dom Casmurro, 1953.",
        "Sousa, J. Galante de. Bibliografia de Machado de Assis, 1955.",
      ],
      en: ["Caldwell, Helen. Introduction to Dom Casmurro, 1953."],
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const english = panel(canvas, "English");

    await userEvent.click(english.getByRole("button", { name: "Add source" }));
    await userEvent.type(
      english.getByLabelText("Source 2"),
      "Sousa. A bibliography of Machado de Assis.",
    );
    await expect(args.onChange).toHaveBeenLastCalledWith("en", [
      "Caldwell, Helen. Introduction to Dom Casmurro, 1953.",
      "Sousa. A bibliography of Machado de Assis.",
    ]);

    await userEvent.click(tab(canvas, "Português"));
    const portuguese = panel(canvas, "Português");
    await expect(portuguese.getAllByRole("textbox")).toHaveLength(2);
    await expect(portuguese.getByLabelText("Source 1")).toHaveValue(
      "Caldwell, Helen. Introdução a Dom Casmurro, 1953.",
    );
  },
};

/**
 * Reordering swaps adjacent entries on screen — moving row 2 up swaps the two.
 * The play test checks that the other language's list keeps its order.
 */
export const Reorder: Story = {
  args: {
    value: {
      pt: ["Primeira fonte", "Segunda fonte"],
      en: ["First source", "Second"],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const english = panel(canvas, "English");

    await userEvent.click(
      english.getByRole("button", { name: "Move source 2 up" }),
    );

    await expect(english.getByLabelText("Source 1")).toHaveValue("Second");
    await expect(english.getByLabelText("Source 2")).toHaveValue(
      "First source",
    );
    await userEvent.click(tab(canvas, "Português"));
    await expect(
      panel(canvas, "Português").getByLabelText("Source 1"),
    ).toHaveValue("Primeira fonte");
  },
};

/** Removing an entry drops its row, leaving the rest. */
export const Remove: Story = {
  args: { value: { pt: [], en: ["First source", "Second source"] } },
  play: async ({ canvasElement }) => {
    const english = panel(within(canvasElement), "English");
    await expect(english.getAllByRole("textbox")).toHaveLength(2);

    await userEvent.click(
      english.getByRole("button", { name: "Remove source 1" }),
    );

    await expect(english.getByLabelText("Source 1")).toHaveValue(
      "Second source",
    );
    await expect(english.queryByLabelText("Source 2")).not.toBeInTheDocument();
  },
};

/**
 * In a browser that can translate, here with the fake Translator API, the
 * English tab drafts its list from the Portuguese one, one source at a time,
 * leaving out a blank source. The tab then asks to check the titles. The play
 * test drafts and checks the list.
 */
export const DraftedFromPortuguese: Story = {
  args: {
    value: {
      pt: [
        "Caldwell, Helen. Introdução, 1953.",
        " ",
        "Sousa, J. Galante de. Bibliografia, 1955.",
      ],
      en: [],
    },
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
      expect(args.onChange).toHaveBeenLastCalledWith("en", [
        "[en] Caldwell, Helen. Introdução, 1953.",
        "[en] Sousa, J. Galante de. Bibliografia, 1955.",
      ]),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      /Check the titles/,
    );
  },
};

/**
 * A draft into a tab that already lists sources asks before it replaces them.
 * The play test cancels and checks that nothing changed, then confirms and
 * checks the draft.
 */
export const ReplacingSources: Story = {
  args: {
    value: {
      pt: ["Caldwell, Helen. Introdução, 1953."],
      en: ["Caldwell. Introduction, as a curator wrote it."],
    },
  },
  beforeEach: installFakeTranslator,
  play: async ({ args, canvasElement }) => {
    const draft = await within(canvasElement).findByRole("button", {
      name: "Draft the sources from Portuguese",
    });
    const question = { name: "Replace the sources in English?" };

    await userEvent.click(draft);
    await userEvent.click(
      within(await screen.findByRole("dialog", question)).getByRole("button", {
        name: "Cancel",
      }),
    );
    await expect(args.onChange).not.toHaveBeenCalled();

    await userEvent.click(draft);
    await userEvent.click(
      within(await screen.findByRole("dialog", question)).getByRole("button", {
        name: "Replace",
      }),
    );
    await waitFor(() =>
      expect(args.onChange).toHaveBeenCalledWith("en", [
        "[en] Caldwell, Helen. Introdução, 1953.",
      ]),
    );
  },
};

/**
 * An error with the sources in one language, here a source too long in
 * Portuguese: its tab is shown in red, and its panel shows the error under the
 * list. The play test checks both.
 */
export const WithError: Story = {
  args: {
    value: { pt: ["Uma fonte"], en: ["A source"] },
    errors: { pt: "This text is too long" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portuguese = tab(canvas, "Português");

    await expect(portuguese).toHaveAttribute("data-invalid", "true");
    await userEvent.click(portuguese);
    await expect(
      panel(canvas, "Português").getByText("This text is too long"),
    ).toBeVisible();
  },
};
