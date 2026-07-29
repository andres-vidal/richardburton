"use client";

import type { OriginalBookValue } from "modules/original-book";
import { Publication } from "modules/publication/model";
import { overrideField } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import pDebounce from "p-debounce";
import { FC, forwardRef, useCallback, useState } from "react";
import { DataInputProps } from "./DataInput";
import MenuProvider from "./MenuProvider";
import TextInput from "./TextInput";

/** What a book is offered as: the title, and who wrote it. */
const describe = (book: OriginalBookValue) => `${book.title} — ${book.authors}`;

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
 * what it is given.
 */
export default forwardRef<HTMLDivElement, DataInputProps>(
  function OriginalBookDataInput(
    { rowId, colId, autoValidated: _autoValidated, value, onChange, ...props },
    ref,
  ) {
    const store = usePublicationStore();

    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [books, setBooks] = useState<OriginalBookValue[]>([]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const getBooks = useCallback(
      pDebounce(
        (search: string) => Publication.autocomplete(search, "originalTitle"),
        350,
      ),
      [],
    );

    async function handleChange(typed: string) {
      onChange?.(typed);

      if (!typed) {
        setIsOpen(false);
        return;
      }

      // A lookup that fails offers nothing: the field is usable without
      // suggestions, and what is being typed is not worth interrupting.
      const found = await getBooks(typed.toLowerCase()).catch(() => []);
      setBooks(found);
      setActiveIndex(0);
      setIsOpen(found.length > 0);
    }

    function handleSelect(option: { id: string; label: string }) {
      const book = books.find((candidate) => describe(candidate) === option.id);
      if (!book) return;

      // The other half of the book, written straight to its own field — the
      // point of the suggestion is that the two never disagree.
      overrideField(store, rowId, "originalAuthors", book.authors);
      onChange?.(book.title);
      setIsOpen(false);
    }

    return (
      <MenuProvider
        options={books.map((book) => ({
          id: describe(book),
          label: describe(book),
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
          ref={ref}
          value={value}
          onChange={handleChange}
          aria-autocomplete="list"
          data-col-id={colId}
        />
      </MenuProvider>
    );
  },
) as FC<DataInputProps>;
