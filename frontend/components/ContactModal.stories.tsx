import type { Meta, StoryObj } from "@storybook/react";
import { ApiError } from "modules/http";
import { expect, fn, mocked, screen, userEvent, waitFor } from "storybook/test";

import { ContactModal, type SendContact } from "./ContactModal";
import Notifications from "./Notifications";

const meta = {
  title: "Components/Contact modal",
  component: ContactModal,
  args: { onSend: fn<SendContact>(async () => {}) },
  // The modal reports what happened to a message in a notification.
  render: (args) => (
    <>
      <ContactModal {...args} />
      <Notifications />
    </>
  ),
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { query: { contact: "true" } } },
    docs: { story: { inline: false, height: "42rem" } },
  },
} satisfies Meta<typeof ContactModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Fills the required fields with a valid message and presses Send. */
async function send() {
  await userEvent.type(await screen.findByLabelText("Name"), "Isabel Burton");
  await userEvent.type(screen.getByLabelText("Email"), "isabel@example.com");
  await userEvent.type(screen.getByLabelText("Subject"), "Iracema");
  await userEvent.type(
    screen.getByLabelText("Write your message here..."),
    "A question about the 1886 translation.",
  );
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

/**
 * The modal opened by `?contact=true` in the URL. The play test checks that
 * the form and its Send button are shown, and sends nothing.
 */
export const Default: Story = {
  play: async ({ args }) => {
    await expect(
      await screen.findByRole("dialog", { name: "Contact us" }),
    ).toHaveTextContent("Contact Us");
    await expect(screen.getByRole("button", { name: "Send" })).toBeVisible();
    await expect(args.onSend).not.toHaveBeenCalled();
  },
};

/**
 * A message the server accepts. The play test checks that the message is sent
 * with what was typed, and that a notification says it was sent.
 */
export const Sent: Story = {
  play: async ({ args }) => {
    await send();

    await waitFor(() =>
      expect(mocked(args.onSend!).mock.lastCall?.[0]).toEqual(
        expect.objectContaining({
          name: "Isabel Burton",
          address: "isabel@example.com",
        }),
      ),
    );
    await expect(await screen.findByRole("status")).toHaveTextContent(
      "Your message has been sent!",
    );
  },
};

/**
 * Fields the server refuses, answered with a 400 that names them. The play
 * test checks that the refusal is shown at its field, in the words the form
 * uses for its own checks, and that nothing is notified.
 */
export const RefusedFields: Story = {
  args: {
    onSend: fn<SendContact>(async () => {
      throw new ApiError(400, { errors: { address: "invalid" } });
    }),
  },
  play: async () => {
    await send();

    await expect(
      await screen.findByText("(Enter a valid email address)"),
    ).toBeVisible();
    await expect(screen.queryByRole("alert")).toBeNull();
  },
};

/**
 * A reCAPTCHA check the server refuses, answered with a 403 and the code
 * `invalid_captcha`. The play test checks that a notification says the check
 * failed, and that the form keeps what was typed.
 */
export const CaptchaRefused: Story = {
  args: {
    onSend: fn<SendContact>(async () => {
      throw new ApiError(403, { error: "invalid_captcha" });
    }),
  },
  play: async () => {
    await send();

    await expect(await screen.findByRole("alert")).toHaveTextContent(
      /captcha/i,
    );
    await expect(screen.getByLabelText("Name")).toHaveValue("Isabel Burton");
  },
};

/**
 * A message the server could not send, answered with a 502 and the code
 * `unsent`. The play test checks that a notification says something went
 * wrong.
 */
export const NotSent: Story = {
  args: {
    onSend: fn<SendContact>(async () => {
      throw new ApiError(502, { error: "unsent" });
    }),
  },
  play: async () => {
    await send();

    await expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong.",
    );
  },
};
