"use client";

import { LOOKUP, type OriginalBook } from "modules/lookup";
import type { PublicationId } from "modules/publication/model";
import { setField } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { Key } from "app";
import { FC, KeyboardEvent, useState } from "react";
import useLookup from "utils/useLookup";
import { DataInputFieldProps } from "./DataInput";
import MenuProvider from "./MenuProvider";
import TextInput from "./TextInput";

/**
 * Returns what tells one offered book from another. Two books can share a
 * title, and two can share their authors, so neither half identifies one on
 * its own.
 */
const identify = (book: OriginalBook) =>
  `${book.title} — ${book.authors.join(", ")}`;

type Props = DataInputFieldProps<string> & {
  /** The row whose original authors a picked book fills. */
  rowId: PublicationId;
};

/**
 * The original title, offering the books already in the database.
 *
 * The original book is one entity — a title and its authors — and entering it
 * field by field is how the same book drifts into near-duplicates, which the
 * composite key then turns into duplicate *publications*. So a suggestion here
 * carries the whole book and fills both fields at once, and a term finds a book
 * by either half of it.
 *
 * Free text stands: a book nobody has entered yet is typed, and the field keeps
 * what it is given. Enter picks the highlighted book while the menu is open,
 * and is `preventDefault`ed then. Otherwise Enter is left to whatever is
 * around the field.
 */
const OriginalBookDataInput: FC<Props> = ({
  rowId,
  value,
  onChange,
  onKeyDown,
  ...props
}) => {
  const store = usePublicationStore();

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [books, setBooks] = useState<OriginalBook[]>([]);

  const { lookup, cancel, busy } = useLookup((term) =>
    LOOKUP.originalBooks(term),
  );

  async function handleChange(typed: string) {
    onChange?.(typed);
    if (!typed) setIsOpen(false);

    const found = await lookup(typed);

    if (found) {
      setBooks(found);
      setActiveIndex(0);
      setIsOpen(found.length > 0);
    }
  }

  // Writes the book's title to this field and its authors to the row's
  // original authors, and closes the menu.
  function choose(book: OriginalBook) {
    setField(store, rowId, "originalAuthors", book.authors);
    onChange?.(book.title);

    cancel();
    setIsOpen(false);
  }

  function handleSelect(option: { id: string; label: string }) {
    const book = books.find((candidate) => identify(candidate) === option.id);
    if (book) choose(book);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const highlighted =
      isOpen && activeIndex !== null ? books[activeIndex] : undefined;

    if (event.key === Key.ENTER && highlighted) {
      event.preventDefault();
      choose(highlighted);
    }

    onKeyDown?.(event);
  }

  return (
    <MenuProvider
      options={books.map((book) => ({
        id: identify(book),
        label: book.title,
        description: book.authors.join(", "),
      }))}
      isOpen={isOpen}
      activeIndex={activeIndex}
      setIsOpen={setIsOpen}
      setActiveIndex={setActiveIndex}
      onSelect={handleSelect}
      bordered={props.bordered}
    >
      <TextInput
        {...props}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        aria-busy={busy}
      />
    </MenuProvider>
  );
};

export default OriginalBookDataInput;
