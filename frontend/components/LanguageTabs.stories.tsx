import type { Meta, StoryObj } from "@storybook/react";
import type { Language } from "modules/publication/model";
import { FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import Button from "./Button";
import LanguageTabs from "./LanguageTabs";

/**
 * Keeps the selected language in state, as a caller does, and shows a line of
 * text in each panel.
 */
const Controlled: FC<{
  selected?: Language;
  onSelect?: (language: Language) => void;
  invalid?: Partial<Record<Language, boolean>>;
  withActions?: boolean;
}> = ({ selected: initial = "en", onSelect, invalid, withActions }) => {
  const [selected, setSelected] = useState(initial);

  return (
    <LanguageTabs
      label="Language of the notes"
      selected={selected}
      onSelect={(language) => {
        setSelected(language);
        onSelect?.(language);
      }}
      invalid={invalid}
      actions={
        withActions ? (
          <Button
            label="An action"
            variant="outline"
            width="fit"
            size="small"
          />
        ) : undefined
      }
    >
      {(language) => (
        <p className="text-sm">
          {language === "pt" ? "Notas em português." : "Notes in English."}
        </p>
      )}
    </LanguageTabs>
  );
};

const meta = {
  title: "Components/Language tabs",
  component: LanguageTabs,
  args: {
    label: "Language of the notes",
    selected: "en",
    onSelect: fn(),
    children: () => null,
  },
  render: (args) => (
    <Controlled
      selected={args.selected}
      onSelect={args.onSelect}
      invalid={args.invalid}
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
} satisfies Meta<typeof LanguageTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The English tab selected, and its panel shown. The play test presses the
 * Português tab and checks that its panel shows and the English one hides.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("tab", { name: "English" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent(
      "Notes in English.",
    );

    await userEvent.click(canvas.getByRole("tab", { name: "Português" }));

    await expect(args.onSelect).toHaveBeenCalledWith("pt");
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent(
      "Notas em português.",
    );
    await expect(canvas.getByText("Notes in English.")).not.toBeVisible();
  },
};

/**
 * The tabs from the keyboard: only the selected tab is in the tab order, and
 * the arrow keys, Home and End select a tab and focus it. The play test tabs
 * into the list and moves with the arrows and Home.
 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const english = canvas.getByRole("tab", { name: "English" });
    const portuguese = canvas.getByRole("tab", { name: "Português" });

    await expect(portuguese).toHaveAttribute("tabindex", "-1");
    await userEvent.tab();
    await expect(english).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");
    await expect(portuguese).toHaveFocus();
    await expect(portuguese).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{End}");
    await expect(english).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(portuguese).toHaveFocus();
  },
};

/**
 * The Portuguese panel holds an error while the English one shows, so the
 * Português tab is shown in red.
 */
export const WithAnError: Story = {
  args: { invalid: { pt: true } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("tab", { name: "Português" }),
    ).toHaveAttribute("data-invalid", "true");
  },
};

/** A button beside the tabs, at the end of their row. */
export const WithActions: Story = {
  render: (args) => (
    <Controlled selected={args.selected} onSelect={args.onSelect} withActions />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "An action" }),
    ).toBeVisible();
  },
};
