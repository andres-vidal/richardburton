import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { installFakeTranslator } from "test/translator";

import DraftButton from "./DraftButton";

const meta = {
  title: "Components/Draft button",
  component: DraftButton,
  args: {
    label: "Draft the notes from Portuguese",
    from: "pt",
    to: "en",
    texts: ["Um clássico do regionalismo.", "Reeditado em 1922."],
    onDrafted: fn(),
  },
  decorators: [
    // White background: the button sits in the white edit form and dialogs.
    (Story) => (
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof DraftButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A browser that can translate: the button names the language it drafts
 * from. The play test presses it, checks that it shows the model downloading
 * and then drafting, and that the translations reach `onDrafted` in order.
 */
export const Default: Story = {
  beforeEach: installFakeTranslator,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Draft the notes from Portuguese",
      }),
    );
    await expect(
      await canvas.findByRole("button", {
        name: /Downloading the translation model/,
      }),
    ).toHaveAttribute("aria-busy", "true");

    await waitFor(() =>
      expect(args.onDrafted).toHaveBeenCalledWith([
        "[en] Um clássico do regionalismo.",
        "[en] Reeditado em 1922.",
      ]),
    );
    await expect(
      canvas.getByRole("button", { name: "Draft the notes from Portuguese" }),
    ).toBeEnabled();
  },
};

/** Nothing to translate: every text is blank, so the button is disabled. */
export const NothingToDraft: Story = {
  beforeEach: installFakeTranslator,
  args: { texts: ["", "  "] },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("button", {
        name: "Draft the notes from Portuguese",
      }),
    ).toBeDisabled();
  },
};

/**
 * A draft that would replace text already written asks first. The play test
 * cancels, checks that nothing was drafted, then confirms and checks the
 * draft.
 */
export const Replacing: Story = {
  beforeEach: installFakeTranslator,
  args: {
    replacing: {
      title: "Replace the notes in English?",
      message:
        "The draft takes the place of the notes this tab holds now. You can still edit it before saving.",
      confirmLabel: "Replace",
    },
  },
  play: async ({ args, canvasElement }) => {
    const button = await within(canvasElement).findByRole("button", {
      name: "Draft the notes from Portuguese",
    });

    await userEvent.click(button);
    await userEvent.click(
      within(
        await screen.findByRole("dialog", {
          name: "Replace the notes in English?",
        }),
      ).getByRole("button", { name: "Cancel" }),
    );
    await expect(args.onDrafted).not.toHaveBeenCalled();

    await userEvent.click(button);
    await userEvent.click(
      within(
        await screen.findByRole("dialog", {
          name: "Replace the notes in English?",
        }),
      ).getByRole("button", { name: "Replace" }),
    );
    await waitFor(() => expect(args.onDrafted).toHaveBeenCalledTimes(1));
  },
};

/**
 * A draft that fails says so under the button, and passes nothing on. The
 * play test makes the fake translator fail and checks the message.
 */
export const Failed: Story = {
  beforeEach: () => {
    const uninstall = installFakeTranslator();
    const translator = (self as unknown as { Translator: { create: unknown } })
      .Translator;

    translator.create = async () => {
      throw new Error("The model could not be downloaded.");
    };

    return uninstall;
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Draft the notes from Portuguese",
      }),
    );

    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "The draft could not be made. Try again.",
    );
    await expect(args.onDrafted).not.toHaveBeenCalled();
  },
};

/**
 * A browser without the Translator API, such as Firefox or Safari: the button
 * renders nothing.
 */
export const WithoutTheTranslatorApi: Story = {
  render: (args) => (
    <div>
      <p className="text-sm text-gray-600">Nothing to draft with here.</p>
      <DraftButton {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Nothing to draft with here."),
    ).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};
