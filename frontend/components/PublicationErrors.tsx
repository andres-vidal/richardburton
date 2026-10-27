"use client";

import {
  useInvalidPublicationIds,
  usePublicationError,
  usePublicationErrorDescription,
  usePublicationFieldError,
  usePublicationRowNumber,
  useVisiblePublication,
} from "modules/publication/hooks";
import { ATTRIBUTES } from "modules/publication/model";
import type { ErrorScope, PublicationId } from "modules/publication/model";
import { setFocusedRowId } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import { Modal } from "./Modal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * The fields an error can name, in the order the table shows them: the
 * attributes, then the sources, then the notes in each language.
 */
const FIELDS: ErrorScope[] = [...ATTRIBUTES, "sources", "notesPt", "notesEn"];

/**
 * One field that was refused, and why. The field is named by its attribute's
 * name, or, for the notes, by the name of the notes in its language.
 */
const FieldError: FC<{ id: PublicationId; field: ErrorScope }> = ({
  id,
  field,
}) => {
  const attribute = useTranslations("attributes");
  const notes = useTranslations("notes");
  const message = usePublicationFieldError(id, field);

  return (
    <>
      <dt className="text-gray-600">
        {field === "notesPt"
          ? notes("field", { language: "pt" })
          : field === "notesEn"
            ? notes("field", { language: "en" })
            : attribute(field)}
      </dt>
      <dd className="text-red-800">{message}</dd>
    </>
  );
};

/**
 * One row that was refused: its number and title, and what is wrong with it.
 * `onGo` runs when the person asks to go to the row.
 *
 * A row whose error is not about any one field, such as a conflict with a
 * record already stored, has the row's own sentence and no list under it.
 */
const RowErrors: FC<{
  id: PublicationId;
  onGo: () => void;
}> = ({ id, onGo }) => {
  const t = useTranslations("errors");
  const position = usePublicationRowNumber(id);
  const publication = useVisiblePublication(id);
  const error = usePublicationError(id);
  const description = usePublicationErrorDescription(id);

  // The failing fields in the order the table shows them, rather than the order
  // the server happened to answer in.
  const fields =
    error !== null && typeof error === "object"
      ? FIELDS.filter((field) => error[field])
      : [];

  return (
    <li className="p-4 space-y-2 rounded-lg border border-red-200 bg-red-50">
      <div className="flex gap-3 justify-between items-baseline">
        <p className="text-sm font-medium">
          {t("rowNumber", { position })}
          {publication.title ? ` — ${publication.title}` : ""}
        </p>
        <Button
          label={t("goToRow")}
          variant="outline"
          width="fit"
          size="small"
          onClick={onGo}
        />
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-red-800">{description}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {fields.map((field) => (
            <FieldError key={field} id={id} field={field} />
          ))}
        </dl>
      )}
    </li>
  );
};

/**
 * A dialog that lists every row of the workspace that has an error, in the
 * order of the rows, with what is wrong with each.
 *
 * Going to a row focuses it, which scrolls the workspace to it, and closes the
 * dialog. The rows and cells of the workspace mark what is wrong one place at a
 * time, and this is the same information as a list.
 */
const PublicationErrors: FC<Props> = ({ isOpen, onClose }) => {
  const t = useTranslations("errors");
  const store = usePublicationStore();
  const invalid = useInvalidPublicationIds();

  function go(id: PublicationId) {
    setFocusedRowId(store, id);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      heading={t("title")}
      subheading={t("description", { count: invalid.length })}
    >
      <ul aria-label={t("title")} className="space-y-2">
        {invalid.map((id) => (
          <RowErrors key={id} id={id} onGo={() => go(id)} />
        ))}
      </ul>
    </Modal>
  );
};

export default PublicationErrors;
