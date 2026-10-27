"use client";

import { Key } from "app";
import { SETTLE } from "modules/publication/checks";
import {
  usePublicationFieldError,
  usePublicationNotes,
} from "modules/publication/hooks";
import type { Language, PublicationId } from "modules/publication/model";
import { setNotes } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import type { RichTextValue } from "modules/rich-text";
import { FC, useLayoutEffect } from "react";
import useDebounce from "utils/useDebounce";
import NotesEditor from "./NotesEditor";

/**
 * The notes field of the row `id` in the enclosing publication store: a
 * `NotesEditor` that shows the row's notes in each language and the error
 * each has.
 *
 * The field writes an edit to the row with `setNotes` once the typing pauses
 * for `SETTLE` milliseconds, so a burst of typing makes one write, of the last
 * value. Each language waits on its own, so typing in one language and then
 * in the other writes both. When the field loses the focus or unmounts, or
 * when Escape is pressed in it, it makes the pending writes at once. An edit
 * typed just before a button such as Save is pressed, before Escape is
 * pressed, or before the field is closed, therefore reaches the row. The
 * writes on Escape run before the handlers around the field receive the key
 * press. A draft is written at once, in place of any pending write of its
 * language.
 *
 * The writes on unmount run in a layout effect's cleanup. React runs it before
 * the `useEffect` cleanups of the components around the field, so the writes
 * land before any of them reads or resets the row.
 */
const NotesField: FC<{ id: PublicationId }> = ({ id }) => {
  const store = usePublicationStore();
  const notes = usePublicationNotes(id);
  const errors = {
    pt: usePublicationFieldError(id, "notesPt"),
    en: usePublicationFieldError(id, "notesEn"),
  };
  const writePt = useDebounce(
    (row: PublicationId, value: RichTextValue | null) =>
      setNotes(store, row, "pt", value),
    SETTLE,
  );
  const writeEn = useDebounce(
    (row: PublicationId, value: RichTextValue | null) =>
      setNotes(store, row, "en", value),
    SETTLE,
  );
  const writes = { pt: writePt, en: writeEn };

  useLayoutEffect(
    () => () => {
      writePt.flush();
      writeEn.flush();
    },
    [writePt, writeEn],
  );

  function flush() {
    writePt.flush();
    writeEn.flush();
  }

  function draft(language: Language, value: RichTextValue) {
    writes[language].cancel();
    setNotes(store, id, language, value);
  }

  return (
    <div
      onBlur={flush}
      onKeyDownCapture={(event) => event.key === Key.ESCAPE && flush()}
    >
      <NotesEditor
        value={notes}
        errors={errors}
        onChange={(language, value) => writes[language](id, value)}
        onDraft={draft}
      />
    </div>
  );
};

export default NotesField;
