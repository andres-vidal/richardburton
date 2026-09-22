"use client";

import {
  useInvalidPublicationIds,
  usePublicationError,
  usePublicationErrorDescription,
  usePublicationFieldError,
  useVisiblePublication,
  useVisiblePublicationIds,
} from "modules/publication/hooks";
import { ATTRIBUTES } from "modules/publication/model";
import type { PublicationId, PublicationKey } from "modules/publication/model";
import { setFocusedRowId } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import ModalHeading from "./ModalHeading";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/** One field that was refused, and why. */
const FieldError: FC<{ id: PublicationId; field: PublicationKey }> = ({
  id,
  field,
}) => {
  const attribute = useTranslations("attributes");
  const message = usePublicationFieldError(id, field);

  return (
    <>
      <dt className="text-gray-600">{attribute(field)}</dt>
      <dd className="text-red-800">{message}</dd>
    </>
  );
};

/**
 * One row that was refused: which row it is, and what is wrong with it.
 *
 * A row whose error is not about any one field — a conflict with a record
 * already stored — has the row's own sentence and no list under it.
 */
const RowErrors: FC<{
  id: PublicationId;
  position: number;
  onGo: () => void;
}> = ({ id, position, onGo }) => {
  const t = useTranslations("errors");
  const publication = useVisiblePublication(id);
  const error = usePublicationError(id);
  const description = usePublicationErrorDescription(id);

  // The failing fields in the order the table shows them, rather than the order
  // the server happened to answer in.
  const fields =
    error !== null && typeof error === "object"
      ? ATTRIBUTES.filter((attribute) => error[attribute])
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
 * Everything the workspace refuses, in one place.
 *
 * The row-by-row signals say which rows are wrong and the cells say which
 * fields; neither reads as a list, and a set assembled from a spreadsheet can be
 * wrong in thirty places at once. This is that list, and each entry leads back
 * to the row it is about.
 */
const PublicationErrors: FC<Props> = ({ isOpen, onClose }) => {
  const t = useTranslations("errors");
  const store = usePublicationStore();
  const invalid = useInvalidPublicationIds();
  const visible = useVisiblePublicationIds() ?? [];

  function go(id: PublicationId) {
    setFocusedRowId(store, id);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} label={t("title")}>
      <div className="p-8 space-y-4 w-full">
        <ModalHeading
          heading={t("title")}
          subheading={t("description", { count: invalid.length })}
        />

        <ul aria-label={t("title")} className="space-y-2">
          {invalid.map((id) => (
            <RowErrors
              key={id}
              id={id}
              position={visible.indexOf(id) + 1}
              onGo={() => go(id)}
            />
          ))}
        </ul>
      </div>
    </Modal>
  );
};

export default PublicationErrors;
