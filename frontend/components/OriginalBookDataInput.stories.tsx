import type { Meta, StoryObj } from "@storybook/react";
import { LOOKUP, type OriginalBook } from "modules/lookup";
import { empty } from "modules/publication/model";
import { publicationFamily, resetAll, setAll } from "modules/publication/store";
import { store } from "modules/store";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import OriginalBookDataInput from "./OriginalBookDataInput";

const LIBRARY: OriginalBook[] = [
  { title: "Dom Casmurro", authors: ["Machado de Assis"] },
  { title: "Memórias Póstumas de Brás Cubas", authors: ["Machado de Assis"] },
  {
    title: "Manuel de Moraes",
    authors: ["Machado de Assis", "J. M. Pereira da Silva"],
  },
];

/**
 * Replaces `LOOKUP.originalBooks` while a story runs with a search of `books`
 * by title or by author, and puts the previous search back afterwards.
 */
const withLibrary = (books: OriginalBook[]) => () => {
  const answering = LOOKUP.originalBooks;

  LOOKUP.originalBooks = async (term) =>
    books.filter(
      (book) =>
        book.title.toLowerCase().includes(term.toLowerCase()) ||
        book.authors.some((author) =>
          author.toLowerCase().includes(term.toLowerCase()),
        ),
    );

  return () => {
    LOOKUP.originalBooks = answering;
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
      setAll(store, [{ id: ROW, publication: empty(), errors: null }]);
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

/**
 * A term offers whole books: the title, and who wrote it. The input carries
 * `aria-busy` until the books for the term arrive.
 */
export const Suggesting: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "Dom Cas");
    await expect(input).toHaveAttribute("aria-busy", "true");

    // `screen`, not the canvas: the menu is portalled out of the field.
    await waitFor(async () =>
      expect(
        await screen.findByRole("option", {
          name: "Dom Casmurro Machado de Assis",
        }),
      ).toBeVisible(),
    );
    await expect(input).toHaveAttribute("aria-busy", "false");
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
      expect(store.get(publicationFamily(ROW)).originalAuthors).toEqual([
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

/**
 * A lookup outlives the keystroke that asked for it, so one already on its way
 * can arrive after a book has been chosen. Offering books again over a field
 * that has just been filled reads as the choice not having been taken.
 */
export const AChoiceSurvivesALookupInFlight: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");

    // Far enough for the menu to open on what was typed...
    await userEvent.type(input, "Dom Casmurr");
    await screen.findByRole("option", { name: /Dom Casmurro/ });

    // ...then one more letter, and the book taken before that lookup lands.
    await userEvent.type(input, "o");
    await userEvent.click(
      await screen.findByRole("option", { name: /Dom Casmurro/ }),
    );

    await expect(args.onChange).toHaveBeenLastCalledWith("Dom Casmurro");

    // The lookup that was in flight must not put the menu back up.
    await waitFor(() =>
      expect(screen.queryAllByRole("option")).toHaveLength(0),
    );
  },
};

/**
 * Enter picks the highlighted book while the menu is open. The play test
 * checks that both fields are filled and that the key is `preventDefault`ed,
 * so a row around the field does not act on it too.
 */
export const PickedWithEnter: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");

    // Read on the document, which hears the key after React has handled it.
    const prevented: boolean[] = [];
    const listen = (event: KeyboardEvent) =>
      prevented.push(event.defaultPrevented);
    document.addEventListener("keydown", listen);

    await userEvent.type(input, "Dom Cas");
    await screen.findByRole("option", { name: /Dom Casmurro/ });
    await userEvent.keyboard("{Enter}");
    document.removeEventListener("keydown", listen);

    await expect(args.onChange).toHaveBeenLastCalledWith("Dom Casmurro");
    await waitFor(() =>
      expect(store.get(publicationFamily(ROW)).originalAuthors).toEqual([
        "Machado de Assis",
      ]),
    );
    await expect(prevented.at(-1)).toBe(true);
  },
};
