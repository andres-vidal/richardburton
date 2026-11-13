import type { Meta, StoryObj } from "@storybook/react";
import type { Language } from "modules/publication/model";
import type { RichTextValue } from "modules/rich-text";
import { FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { item, link, paragraph } from "test/rich-text-fixtures";
import { editorOf } from "test/slate";
import { installFakeTranslator } from "test/translator";

import NotesEditor from "./NotesEditor";

type Notes = Record<Language, RichTextValue | null>;

/**
 * Keeps the notes in state, as a caller does, so an edit or a draft shows in
 * the editor. `onChange` is still called, so the stories can check it.
 */
const Controlled: FC<{
  value: Notes;
  onChange: (language: Language, value: RichTextValue | null) => void;
  errors?: Partial<Record<Language, string>>;
}> = ({ value: initial, onChange, errors }) => {
  const [value, setValue] = useState(initial);

  return (
    <NotesEditor
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
  title: "Publications/Notes editor",
  component: NotesEditor,
  args: { value: { pt: null, en: null }, onChange: fn() },
  render: (args) => (
    <Controlled
      value={args.value}
      onChange={args.onChange}
      errors={args.errors}
    />
  ),
  decorators: [
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white rounded-lg border border-gray-200">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof NotesEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Returns the tab named `name` in the editor's tab list. */
const tab = (name: string) =>
  within(
    screen.getByRole("tablist", { name: "Language of the notes" }),
  ).getByRole("tab", { name });

/**
 * Notes in both languages. The English tab is selected for a reader of
 * English. The play test reads both tabs.
 */
export const Default: Story = {
  args: {
    value: {
      pt: [paragraph("Um ", { text: "clássico", bold: true }, ".")],
      en: [paragraph("A ", { text: "classic", bold: true }, ".")],
    },
  },
  play: async () => {
    await expect(
      editorOf(await screen.findByRole("textbox", { name: "Notes in English" }))
        .children,
    ).toEqual([paragraph("A ", { text: "classic", bold: true }, ".")]);

    await userEvent.click(tab("Português"));
    await expect(
      editorOf(
        await screen.findByRole("textbox", { name: "Notes in Portuguese" }),
      ).children,
    ).toEqual([paragraph("Um ", { text: "clássico", bold: true }, ".")]);
  },
};

/** No notes in either language: each tab shows the placeholder. */
export const Empty: Story = {
  play: async () => {
    await expect(
      await screen.findByRole("textbox", { name: "Notes in English" }),
    ).toHaveAccessibleDescription(
      "Shown to everyone on the publication's page.",
    );
  },
};

/**
 * An error with the notes in Portuguese while the English tab shows: the
 * Português tab is shown in red, and the error is under the Portuguese text.
 */
export const WithAnError: Story = {
  args: {
    value: { pt: [paragraph("Uma nota longa demais")], en: null },
    errors: { pt: "This text is too long" },
  },
  play: async () => {
    await expect(tab("Português")).toHaveAttribute("data-invalid", "true");
    await userEvent.click(tab("Português"));
    await expect(
      await screen.findByRole("textbox", { name: "Notes in Portuguese" }),
    ).toHaveAccessibleDescription(/This text is too long/);
  },
};

/**
 * In a browser that can translate, here with the fake Translator API, the
 * English tab drafts its notes from the Portuguese ones. The draft keeps each
 * block, its list and its depth, and drops the bold, the italic and a link
 * that shows other text than its address. The play test drafts and checks the
 * value passed to `onChange`.
 */
export const Drafting: Story = {
  args: {
    value: {
      pt: [
        paragraph("Um ", { text: "clássico", bold: true }, "."),
        item(
          "numbered",
          1,
          "Ver ",
          link("https://archive.org/details/x", "o exemplar"),
          " ou https://archive.org/details/y",
        ),
      ],
      en: null,
    },
  },
  beforeEach: installFakeTranslator,
  play: async ({ args }) => {
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Draft the notes from Portuguese",
      }),
    );

    await waitFor(() =>
      expect(args.onChange).toHaveBeenCalledWith("en", [
        paragraph("[en] Um clássico."),
        item(
          "numbered",
          1,
          "[en] Ver o exemplar ou ",
          link(
            "https://archive.org/details/y",
            "https://archive.org/details/y",
          ),
        ),
      ]),
    );
  },
};

/**
 * A draft into a tab that already has notes asks before it replaces them. The
 * play test cancels and checks that nothing changed, then confirms and checks
 * the draft.
 */
export const ReplacingNotes: Story = {
  args: {
    value: {
      pt: [paragraph("Um clássico.")],
      en: [paragraph("A classic, as a curator wrote it.")],
    },
  },
  beforeEach: installFakeTranslator,
  play: async ({ args }) => {
    const draft = await screen.findByRole("button", {
      name: "Draft the notes from Portuguese",
    });
    const question = { name: "Replace the notes in English?" };

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
        paragraph("[en] Um clássico."),
      ]),
    );
  },
};

/**
 * A browser without the Translator API: the tabs have no draft button, and
 * both languages can still be edited.
 */
export const WithoutTheTranslatorApi: Story = {
  args: { value: { pt: [paragraph("Um clássico.")], en: null } },
  play: async () => {
    await screen.findByRole("textbox", { name: "Notes in English" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await expect(
      screen.queryByRole("button", { name: "Draft the notes from Portuguese" }),
    ).toBeNull();
  },
};
