"use client";

import type { WithChanges } from "modules/publication/history";
import {
  useIsPublicationValid,
  usePublication,
  usePublicationErrorDescription,
  usePublicationField,
  usePublicationFieldError,
  usePublicationReferences,
} from "modules/publication/hooks";
import {
  Publication,
  type PublicationHistoryEntry,
  type PublicationId,
  type PublicationKey,
} from "modules/publication/model";
import {
  deletePublication,
  history,
  update,
  validateUpdate,
} from "modules/publication/remote";
import { discardEdit, overrideReferences } from "modules/publication/store";
import { useIsAdmin } from "modules/session";
import { FC, SubmitEvent, SyntheticEvent, useState } from "react";
import { z } from "zod";
import { Article } from "./Article";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import CopyLink from "./CopyLink";
import DataInput from "./DataInput";
import { Modal, useModal, useURLQueryModal } from "./Modal";
import PublicationDetail, { PublicationHeading } from "./PublicationDetail";
import PublicationHistory from "./PublicationHistory";
import ReferencesEditor from "./ReferencesEditor";

const PUBLICATION_MODAL_KEY = "publication";

const Param = z.string().regex(/^\d+$/).transform(Number).optional();
type Param = z.infer<typeof Param>;

/**
 * Admin-only, lazily loaded: the mutation log is fetched on first expand, so
 * opening the modal costs nothing extra and the section works offline in
 * Storybook (nothing fetches until a user opens it).
 */
const PublicationHistorySection: FC<{ id: PublicationId }> = ({ id }) => {
  const [entries, setEntries] =
    useState<WithChanges<PublicationHistoryEntry>[]>();

  async function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open && entries === undefined) {
      setEntries(await history(id));
    }
  }

  return (
    <details className="space-y-2" onToggle={handleToggle}>
      <summary className="text-sm font-medium tracking-wide text-gray-500 uppercase cursor-pointer select-none">
        History
      </summary>
      {entries === undefined ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <PublicationHistory entries={entries} />
      )}
    </details>
  );
};

const EditField: FC<{ id: PublicationId; attribute: PublicationKey }> = ({
  id,
  attribute,
}) => {
  const value = usePublicationField(id, attribute);
  const error = usePublicationFieldError(id, attribute);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-gray-500">
        {Publication.ATTRIBUTE_LABELS[attribute]}
      </span>
      <DataInput
        rowId={id}
        colId={attribute}
        value={value}
        error={error}
        aria-label={Publication.ATTRIBUTE_LABELS[attribute]}
        bordered
        autoValidated
        // A form has room to say what is wrong, in place.
        errorDisplay="inline"
        onValidate={() => validateUpdate(id)}
      />
    </div>
  );
};

const PublicationEditForm: FC<{ id: PublicationId; onDone: () => void }> = ({
  id,
  onDone,
}) => {
  const [saving, setSaving] = useState(false);
  const error = usePublicationErrorDescription(id);
  const isValid = useIsPublicationValid(id);
  const references = usePublicationReferences(id);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await update(id);
    setSaving(false);
    if (saved) onDone();
  }

  function handleCancel() {
    discardEdit(id);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-8 w-full">
      <h1 className="text-2xl font-normal">Edit publication</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {Publication.ATTRIBUTES.map((attribute) => (
          <EditField key={attribute} id={id} attribute={attribute} />
        ))}
      </div>
      <ReferencesEditor
        value={references}
        onChange={(next) => overrideReferences(id, next)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        <Button
          label="Cancel"
          variant="outline"
          width="fit"
          size="medium"
          onClick={handleCancel}
        />
        <Button
          label="Save"
          type="submit"
          width="fit"
          size="medium"
          loading={saving}
          // Nothing to gain from a round-trip we know the server will reject.
          // `saving` is included because Button lets an explicit `disabled`
          // override its own `loading`-implies-disabled.
          disabled={!isValid || saving}
        />
      </div>
    </form>
  );
};

const PublicationModal: FC = () => {
  const { value, ...modal } = useURLQueryModal(PUBLICATION_MODAL_KEY);

  const publicationId = Param.parse(value);

  const publication = usePublication(publicationId);
  const isAdmin = useIsAdmin();

  const [editingId, setEditingId] = useState<PublicationId>();
  const editing = editingId !== undefined && editingId === publicationId;

  const deleteConfirmation = useModal();
  const [deleting, setDeleting] = useState(false);

  function close() {
    if (editing && publicationId !== undefined) discardEdit(publicationId);
    modal.close();
  }

  async function handleDelete() {
    if (publicationId === undefined) return;
    setDeleting(true);
    const removed = await deletePublication(publicationId);
    setDeleting(false);
    deleteConfirmation.close();
    if (removed) modal.close();
  }

  return (
    <>
      <Modal isOpen={modal.isOpen} onClose={close} label="Publication details">
        {publication &&
          publicationId !== undefined &&
          (editing ? (
            <PublicationEditForm
              id={publicationId}
              onDone={() => setEditingId(undefined)}
            />
          ) : (
            <Article
              heading={<PublicationHeading publication={publication} />}
              content={
                <PublicationDetail
                  publication={publication}
                  onNavigate={modal.close}
                  actions={
                    <>
                      {/* Everyone, not just admins: the URL bar is still
                          showing the index underneath, so this is the only
                          place the publication's own address appears. */}
                      <CopyLink href={`/publications/${publicationId}`} />
                      {isAdmin && (
                        <>
                          <PublicationHistorySection id={publicationId} />
                          <div className="flex gap-3">
                            <Button
                              label="Edit"
                              variant="outline-primary"
                              width="fit"
                              size="medium"
                              onClick={() => setEditingId(publicationId)}
                            />
                            <Button
                              label="Delete"
                              variant="danger"
                              width="fit"
                              size="medium"
                              onClick={() => deleteConfirmation.open()}
                            />
                          </div>
                        </>
                      )}
                    </>
                  }
                />
              }
            />
          ))}
      </Modal>
      {publication && (
        <ConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          title="Delete this publication?"
          message={`“${publication.title}” (${publication.year}) will be removed from the catalogue, its index, and search results.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={deleteConfirmation.close}
        />
      )}
    </>
  );
};

export { PUBLICATION_MODAL_KEY, PublicationModal };
