import type { Meta, StoryObj } from "@storybook/react";
import { empty } from "modules/publication/model";
import { expect, fn, screen, userEvent } from "storybook/test";

import Button from "./Button";
import PublicationDetail from "./PublicationDetail";

const DOM_CASMURRO = {
  ...empty(),
  id: 7,
  title: "Dom Casmurro",
  authors: "Helen Caldwell",
  originalTitle: "Dom Casmurro",
  originalAuthors: "Machado de Assis",
  year: "1953",
  countries: "US",
  publishers: "Noonday Press",
  references: [
    "Caldwell, Helen. Introduction, 1953.",
    "Gledson, John. Deceptive Realism, 1984.",
  ],
};

const meta = {
  title: "Publications/Publication detail",
  component: PublicationDetail,
  args: { publication: DOM_CASMURRO },
  decorators: [
    (Story) => (
      <div className="p-8 max-w-2xl bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PublicationDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

/** What a reader sees: the record as a sentence, and its sources. */
export const Default: Story = {
  play: async () => {
    // Every field a reader might want to pivot on is a search link.
    await expect(
      screen.getByRole("link", { name: "Machado de Assis" }),
    ).toHaveAttribute("href", "/?search=Machado de Assis");

    // Countries render their label but search by the stored code.
    await expect(
      screen.getByRole("link", { name: "United States of America" }),
    ).toHaveAttribute("href", "/?search=US");

    await expect(
      screen.getByText("Gledson, John. Deceptive Realism, 1984."),
    ).toBeInTheDocument();
  },
};

/** A record nobody has sourced yet simply omits the section. */
export const WithoutReferences: Story = {
  args: { publication: { ...DOM_CASMURRO, references: [] } },
  play: async () => {
    await expect(screen.queryByText("References")).not.toBeInTheDocument();
  },
};

/**
 * Admin affordances are passed in rather than decided here, so the view is the
 * same one a signed-out reader gets.
 */
export const WithActions: Story = {
  args: {
    actions: <Button label="Edit" variant="outline-primary" width="fit" />,
  },
  play: async () => {
    await expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
  },
};

/**
 * Following a search link tells the caller — an overlay uses it to close
 * itself, a page ignores it.
 */
export const NotifiesOnNavigate: Story = {
  args: { onNavigate: fn() },
  play: async ({ args }) => {
    await userEvent.click(screen.getByRole("link", { name: "Helen Caldwell" }));
    await expect(args.onNavigate).toHaveBeenCalled();
  },
};
