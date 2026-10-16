"use client";

import { SETTLE } from "modules/publication/checks";
import {
  usePublicationFieldError,
  usePublicationNotes,
} from "modules/publication/hooks";
import type { PublicationId } from "modules/publication/model";
import { setNotes } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import type { RichTextValue } from "modules/rich-text";
import { useTranslations } from "next-intl";
import { FC, useLayoutEffect } from "react";
import useDebounce from "utils/useDebounce";
import LazyRichTextArea from "./LazyRichTextArea";

/**
 * The notes field of the row `id` in the enclosing publication store: a
 * `LazyRichTextArea` with the notes' label, hint and placeholder, that shows
 * the row's notes and the error they have.
 *
 * The field writes an edit to the row with `setNotes` once the typing pauses
 * for `SETTLE` milliseconds, so a burst of typing makes one write, of the last
 * value. When the field loses the focus or unmounts, it makes a pending write
 * at once. An edit typed just before a button such as Save is pressed, or just
 * before the field is closed, therefore reaches the row.
 *
 * The write on unmount runs in a layout effect's cleanup. React runs it before
 * the `useEffect` cleanups of the components around the field, so the write
 * lands before any of them reads or resets the row.
 */
const NotesField: FC<{ id: PublicationId }> = ({ id }) => {
  const t = useTranslations("notes");
  const attribute = useTranslations("attributes");
  const store = usePublicationStore();
  const notes = usePublicationNotes(id);
  const error = usePublicationFieldError(id, "notes");
  const write = useDebounce(
    (row: PublicationId, value: RichTextValue | null) =>
      setNotes(store, row, value),
    SETTLE,
  );

  useLayoutEffect(() => () => write.flush(), [write]);

  return (
    <div onBlur={() => write.flush()}>
      <LazyRichTextArea
        label={attribute("notes")}
        hint={t("hint")}
        placeholder={t("placeholder")}
        value={notes}
        error={error}
        onChange={(value) => write(id, value)}
      />
    </div>
  );
};

export default NotesField;
