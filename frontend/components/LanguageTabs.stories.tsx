import type { Meta, StoryObj } from "@storybook/react";
import type { Language } from "modules/publication/model";
import { FC, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import Button from "./Button";
import LanguageTabs from "./LanguageTabs";

/**
 * Keeps the selected language in state, as a caller does, and shows a line of
 * text in each panel.
 */
const Controlled: FC<{
  selected?: Language;
  onSelect?: (language: Language) => void;
  errors?: Partial<Record<Language, string>>;
  empty?: Partial<Record<Language, boolean>>;
  withActions?: boolean;
}> = ({ selected: initial = "en", onSelect, errors, empty, withActions }) => {
  const [selected, setSelected] = useState(initial);

  return (
    <LanguageTabs
      label="Language of the notes"
      selected={selected}
      onSelect={(language) => {
        setSelected(language);
        onSelect?.(language);
      }}
      errors={errors}
      empty={empty}
      actions={
        withActions
          ? (language) => (
              <Button
                label={language === "pt" ? "Uma ação" : "An action"}
                variant="outline"
                width="fit"
                size="small"
              />
            )
          : undefined
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

/**
 * Returns how much redder than blue the text of an element is, from its
 * computed colour drawn on a canvas. Red text gives a large positive number,
 * and gray or indigo text gives zero or less.
 */
function redness(element: HTMLElement): number {
  const context = document.createElement("canvas").getContext("2d")!;
  context.fillStyle = getComputedStyle(element).color;
  context.fillRect(0, 0, 1, 1);
  const [red, , blue] = context.getImageData(0, 0, 1, 1).data;

  return red - blue;
}

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
      errors={args.errors}
      empty={args.empty}
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
 * Português tab is shown in red. The play test checks that its text is red
 * and the English tab's is not, then selects it and checks that it stays red.
 */
export const WithAnError: Story = {
  args: { errors: { pt: "The notes are too long." } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portuguese = canvas.getByRole("tab", { name: "Português" });
    const english = canvas.getByRole("tab", { name: "English" });

    await expect(portuguese).toHaveAttribute("data-state", "invalid");
    await waitFor(() => expect(redness(portuguese)).toBeGreaterThan(50));
    await expect(redness(english)).toBeLessThan(50);

    await userEvent.click(portuguese);

    await expect(portuguese).toHaveAttribute("data-state", "selected-invalid");
    await waitFor(() => expect(redness(portuguese)).toBeGreaterThan(50));
  },
};

/**
 * Nothing is written in Portuguese, so the Português tab says it is empty.
 * The play test checks that the mark describes that tab and no other.
 */
export const WithAnEmptyLanguage: Story = {
  args: { empty: { pt: true, en: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("tab", { name: "Português" }),
    ).toHaveAccessibleDescription("empty");
    await expect(
      canvas.getByRole("tab", { name: "English" }),
    ).toHaveAccessibleDescription("");
  },
};

/**
 * What acts on a panel is at the top of it. The play test checks that the
 * selected panel's button shows and the other panel's does not.
 */
export const WithActions: Story = {
  render: (args) => (
    <Controlled selected={args.selected} onSelect={args.onSelect} withActions />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("button", { name: "An action" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Uma ação" })).toBeNull();
  },
};

/**
 * In a container of 48rem or wider, the two panels show side by side, each
 * under the name of its language and with its own action, and the tabs are
 * hidden. The Portuguese panel holds an error, so its name is red. The play
 * test checks that both panels and both actions show, and no tab does.
 */
export const SideBySide: Story = {
  args: { errors: { pt: "The notes are too long." } },
  render: (args) => (
    <Controlled
      selected={args.selected}
      onSelect={args.onSelect}
      errors={args.errors}
      withActions
    />
  ),
  decorators: [
    (Story) => (
      <div className="p-6 w-4xl bg-white rounded-lg border border-gray-200">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole("tab")).toBeNull();
    await expect(canvas.getByText("Notas em português.")).toBeVisible();
    await expect(canvas.getByText("Notes in English.")).toBeVisible();
    await expect(
      within(canvas.getByRole("tabpanel", { name: "Português" })).getByRole(
        "button",
        { name: "Uma ação" },
      ),
    ).toBeVisible();
    await expect(
      within(canvas.getByRole("tabpanel", { name: "English" })).getByRole(
        "button",
        { name: "An action" },
      ),
    ).toBeVisible();
  },
};
