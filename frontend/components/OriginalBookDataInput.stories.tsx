import type { Meta, StoryObj } from "@storybook/react";
import { OriginalBook, type OriginalBookValue } from "modules/original-book";
import { empty } from "modules/publication/model";
import {
  publicationFamily,
  resetAll,
  visiblePublicationFamily,
} from "modules/publication/store";
import { store } from "modules/store";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import OriginalBookDataInput from "./OriginalBookDataInput";

const LIBRARY: OriginalBookValue[] = [
  { title: "Dom Casmurro", authors: ["Machado de Assis"] },
  { title: "Memórias Póstumas de Brás Cubas", authors: ["Machado de Assis"] },
  {
    title: "Manuel de Moraes",
    authors: ["Machado de Assis", "J. M. Pereira da Silva"],
  },
];

/**
 * Stand in for the database while a story runs. The module exposes its calls
 * as one `REMOTE` object precisely so a caller can be given a different one.
 */
const withLibrary = (books: OriginalBookValue[]) => () => {
  const answering = OriginalBook.REMOTE.search;

  OriginalBook.REMOTE.search = async (term) =>
    books.filter(
      (book) =>
        book.title.toLowerCase().includes(term.toLowerCase()) ||
        book.authors.some((author) =>
          author.toLowerCase().includes(term.toLowerCase()),
        ),
    );

  return () => {
    OriginalBook.REMOTE.search = answering;
  };
};

// The field is controlled by the row it edits; hold the value here so what is
// typed shows on screen.
const Controlled: FC<ComponentProps<typeof OriginalBookDataInput>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);

  return (
    <OriginalBookDataInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const ROW = 1;

const meta = {
  title: "Publications/Original book data input",
  component: OriginalBookDataInput,
  args: {
    rowId: ROW,
    colId: "originalTitle",
    value: "",
    error: "",
    bordered: true,
    // The dispatcher supplies this from the attribute's label; a story that
    // renders the field on its own has to say it.
    placeholder: "Original Title",
    onChange: fn(),
  },
  render: (args) => <Controlled {...args} />,
  beforeEach: [
    () => {
      resetAll(store);
      store.set(publicationFamily(ROW), empty());
    },
    withLibrary(LIBRARY),
  ],
  decorators: [
    (Story) => (
      <div className="p-8 w-96 bg-white">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "centered",
    // The open menu renders focus guards (tabbable, aria-hidden) to trap focus
    // — a deliberate pattern axe's aria-hidden-focus rule reads as a violation.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
} satisfies Meta<typeof OriginalBookDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A term offers whole books: the title, and who wrote it. */
export const Suggesting: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByRole("combobox"),
      "Dom Cas",
    );

    // `screen`, not the canvas: the menu is portalled out of the field.
    await waitFor(async () =>
      expect(
        await screen.findByRole("option", {
          name: "Dom Casmurro Machado de Assis",
        }),
      ).toBeVisible(),
    );
  },
};

/** A term finds a book by its author too — either half of it will do. */
export const FoundByItsAuthor: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByRole("combobox"),
      "Machado",
    );

    await waitFor(async () =>
      expect(await screen.findAllByRole("option")).toHaveLength(3),
    );
  },
};

/**
 * Picking a book fills both fields: the title here, and the authors in the
 * field that holds them. That is the point — entering the two apart is how the
 * same book drifts into near-duplicates.
 */
export const FillsBothFields: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole("combobox"), "Manuel");

    await userEvent.click(
      await screen.findByRole("option", {
        name: "Manuel de Moraes Machado de Assis, J. M. Pereira da Silva",
      }),
    );

    await expect(args.onChange).toHaveBeenCalledWith("Manuel de Moraes");
    // The other half went straight to its own field.
    await waitFor(() =>
      expect(store.get(visiblePublicationFamily(ROW)).originalAuthors).toEqual([
        "Machado de Assis",
        "J. M. Pereira da Silva",
      ]),
    );
  },
};

/** A book nobody has entered yet is typed, and the field keeps what it is given. */
export const FreeTextStands: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "Uma Obra Inédita");

    await expect(input).toHaveValue("Uma Obra Inédita");
    await waitFor(async () =>
      expect(screen.queryAllByRole("option")).toHaveLength(0),
    );
  },
};
