"use client";

import ExitIcon from "assets/exit.svg";
import { moveRows } from "modules/publication/document-move";
import {
  DOCUMENTS_PER_PAGE,
  create,
  list,
  type DocumentPage,
  type DocumentSummary,
} from "modules/publication/document-remote";
import type { PublicationId } from "modules/publication/model";
import { usePublicationStore } from "modules/publication/workspace";
import {
  clearSelection,
  getSelection,
  useSelectionSize,
} from "modules/selection";
import { useTranslations } from "next-intl";
import { FC, FormEvent, useState } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import { useNotify } from "./Notifications";
import TextInput from "./TextInput";

/** Where the rows go: a new document, or the document with that id. */
type Choice = "new" | number;

/**
 * Moves the selected rows of an import document to another import document,
 * either one that exists or a new one named on the spot.
 *
 * It renders the **Move N** button while rows are selected. The button opens a
 * dialog listing the other import documents that are not archived, newest
 * first, a page at a time. The rows are added at the end of the chosen document
 * and leave this one for everyone working on either. When the move fails, the
 * rows stay where they were and the dialog stays open. A new document created
 * before a failed move is kept and chosen, so trying again does not create a
 * second one.
 *
 * The dialog moves the rows that were selected when it opened. A click that is
 * not on a row clears the selection, including the click that opens the
 * dialog, so the component is meant to stay mounted while the selection
 * changes, with only its button depending on it.
 */
const PublicationMove: FC<{
  /** The import document the rows are in. It is left out of the list. */
  document: number;
  /** Reads a page of import documents. Defaults to `list` from `document-remote`. */
  readDocuments?: typeof list;
  /** Starts a document with the given name. Defaults to `create`. */
  start?: (name: string) => Promise<DocumentSummary>;
  /** Moves rows of the store's document to another document. Defaults to `moveRows`. */
  move?: typeof moveRows;
}> = ({ document, readDocuments = list, start = create, move = moveRows }) => {
  const t = useTranslations("moving");
  const admin = useTranslations("admin");
  const documents = useTranslations("documents");
  const store = usePublicationStore();
  const notify = useNotify();
  const selected = useSelectionSize();

  const [isOpen, setOpen] = useState(false);
  const [ids, setIds] = useState<PublicationId[]>([]);
  const [page, setPage] = useState<DocumentPage>({ entries: [], more: false });
  const [reading, setReading] = useState(false);
  const [choice, setChoice] = useState<Choice>("new");
  const [name, setName] = useState("");
  const [moving, setMoving] = useState(false);

  const others = page.entries.filter(({ id }) => id !== document);
  const canMove = choice !== "new" || name.trim() !== "";

  // Reads the page of documents after `after`, or the first page without it,
  // and adds it to the list. A page that cannot be read adds nothing, which
  // leaves a new document as the only choice.
  async function read(after?: DocumentSummary) {
    setReading(true);

    try {
      const found = await readDocuments({
        limit: DOCUMENTS_PER_PAGE,
        archived: false,
        after: after && { id: after.id, updatedAt: after.updatedAt },
      });

      setPage((shown) => ({
        entries: [...(after ? shown.entries : []), ...found.entries],
        more: found.more,
      }));
    } catch {
      setPage((shown) => ({ ...shown, more: false }));
    } finally {
      setReading(false);
    }
  }

  function open() {
    setIds([...getSelection(store)] as PublicationId[]);
    setChoice("new");
    setName("");
    setPage({ entries: [], more: false });
    setOpen(true);
    read();
  }

  function close() {
    if (!moving) setOpen(false);
  }

  // Returns the document to move into, creating it first when it is new. A
  // created document is added to the list and chosen.
  async function target(): Promise<DocumentSummary> {
    const chosen = others.find(({ id }) => id === choice);
    if (chosen) return chosen;

    const created = await start(name.trim());

    setPage((shown) => ({ ...shown, entries: [created, ...shown.entries] }));
    setChoice(created.id);

    return created;
  }

  async function moveSelected(event: FormEvent) {
    event.preventDefault();
    if (!canMove || moving) return;

    setMoving(true);

    try {
      const destination = await target();
      await move(store, ids, destination.id);

      clearSelection(store);
      setOpen(false);
      notify({
        message: "notify.rowsMoved",
        detail: "notify.rowsMovedDetail",
        values: { count: ids.length, name: destination.name },
        level: "success",
      });
    } catch {
      notify({
        message: "notify.moveFailed",
        detail: "notify.moveFailedDetail",
        level: "warning",
      });
    } finally {
      setMoving(false);
    }
  }

  return (
    <>
      {selected > 0 ? (
        <Button
          label={admin("move", { count: selected })}
          variant="secondary"
          alignment="left"
          width="fit"
          Icon={ExitIcon}
          onClick={open}
        />
      ) : null}
      <Modal
        isOpen={isOpen}
        onClose={close}
        label={t("heading", { count: ids.length })}
      >
        <form
          className="flex flex-col gap-5 p-8 w-full"
          onSubmit={moveSelected}
        >
          <h1 className="text-2xl font-normal">
            {t("heading", { count: ids.length })}
          </h1>
          <p className="text-gray-700">{t("description")}</p>
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">{t("target")}</legend>
            <label className="flex gap-3 items-center">
              <input
                type="radio"
                name="target"
                className="accent-indigo-600"
                checked={choice === "new"}
                onChange={() => setChoice("new")}
              />
              {t("newDocument")}
            </label>
            {choice === "new" ? (
              <TextInput
                label={t("nameLabel")}
                placeholder={documents("namePlaceholder")}
                value={name}
                onChange={setName}
              />
            ) : null}
            {others.map((other) => (
              <label key={other.id} className="flex gap-3 items-center">
                <input
                  type="radio"
                  name="target"
                  className="accent-indigo-600"
                  checked={choice === other.id}
                  onChange={() => setChoice(other.id)}
                />
                <span>{other.name}</span>
                <span className="text-sm text-gray-500">
                  {documents("rows", { count: other.rows })}
                </span>
              </label>
            ))}
            {page.more ? (
              <Button
                label={documents("more")}
                variant="outline"
                width="fit"
                loading={reading}
                onClick={() => read(page.entries.at(-1))}
              />
            ) : null}
          </fieldset>
          <div className="flex gap-3 justify-end">
            <Button
              label={t("cancel")}
              variant="outline"
              width="fit"
              size="medium"
              disabled={moving}
              onClick={close}
            />
            <Button
              type="submit"
              label={t("confirm", { count: ids.length })}
              width="fit"
              size="medium"
              loading={moving}
              disabled={!canMove || moving}
            />
          </div>
        </form>
      </Modal>
    </>
  );
};

export default PublicationMove;
