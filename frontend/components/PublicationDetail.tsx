"use client";

import type { WithChanges } from "modules/publication/history";
import {
  useIsPublicationValid,
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
  update,
  validateUpdate,
} from "modules/publication/remote";
import {
  discardEdit,
  overrideReferences,
  remember,
} from "modules/publication/store";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import { useCanEditPublications } from "modules/session";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FC, SubmitEvent, useEffect, useState } from "react";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import DataInput from "./DataInput";
import { useModal } from "./Modal";
import PublicationHistory from "./PublicationHistory";
import ReferencesEditor from "./ReferencesEditor";
import SectionHeading, { SECTION_HEADING } from "./SectionHeading";
import Tooltip from "./Tooltip";

const Searchable: FC<{ label: string; value?: string }> = ({
  value,
  label,
}) => (
  <Link href={`/?search=${value || label}`} className="anchor">
    {label}
  </Link>
);

/**
 * The items of a list, inline in a sentence, each a link to its own search.
 *
 * Nothing follows the last item — no trailing space — so the sentence's own
 * punctuation sits against it. A space there is a place the line may break, and
 * a full stop that wraps onto the next line reads as a mistake in the record.
 */
const SearchableList: FC<{
  items: { label: string; value?: string }[];
}> = ({ items }) => (
  <ul className="contents">
    {items.map((item, index) => (
      <li key={item.value} className="contents">
        {index != 0 && index === items.length - 1 && " and "}
        <Searchable {...item} />
        {index < items.length - 2 && ", "}
      </li>
    ))}
  </ul>
);

const PublicationHeading: FC<{ publication: Publication }> = ({
  publication,
}) => (
  <div className="flex flex-col w-full text-2xl font-normal sm:gap-2 sm:items-center sm:flex-row">
    <Tooltip variant="info" message="Translation's title">
      <span className="w-full truncate sm:w-min whitespace-nowrap">
        {publication.title}
      </span>
    </Tooltip>
    <Tooltip variant="info" message="Who translated this publication">
      <span className="text-lg font-light tracking-tighter text-indigo-500 sm:text-xl whitespace-nowrap">
        ({publication.authors})
      </span>
    </Tooltip>
  </div>
);

const PublicationDescription: FC<{ publication: Publication }> = ({
  publication: p,
}) => {
  function getSearchableItems(p: Publication, key: PublicationKey) {
    return p[key]
      .split(",")
      .map((value) => value.trim())
      .map((value) => ({
        value,
        label: Publication.describeValue(value, key),
      }));
  }

  const list = (key: PublicationKey) => (
    <SearchableList items={getSearchableItems(p, key)} />
  );

  return (
    <div>
      <Searchable label={p.title} /> is a translation of{" "}
      <Searchable label={p.originalTitle} />, by {list("originalAuthors")}. It
      was written by {list("authors")} and published in {list("countries")} in{" "}
      {p.year} by {list("publishers")}.
    </div>
  );
};

/**
 * Where the record says it comes from.
 *
 * A record with no sources says so rather than leaving the section out: for a
 * database whose worth is its provenance, an absent source is worth stating.
 * The history section states its absence the same way.
 */
const PublicationReferences: FC<{ references: string[] }> = ({
  references,
}) => (
  <section className="space-y-2">
    <SectionHeading>References</SectionHeading>
    {references.length === 0 ? (
      <p className="text-xs text-gray-500">
        No sources recorded yet — this record has not been backed up by one.
      </p>
    ) : (
      <ul className="space-y-1.5 text-sm text-gray-700">
        {references.map((reference, index) => (
          <li key={index} className="flex gap-2.5 items-baseline">
            <span
              aria-hidden
              className="size-1.5 rounded-full shrink-0 bg-indigo-400 ring-2 ring-indigo-100"
            />
            <span className="wrap-break-words">{reference}</span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/**
 * The record's mutation log, collapsed. The entries arrive with the record, so
 * expanding it costs nothing and shows everything at once.
 */
const PublicationHistorySection: FC<{
  entries: WithChanges<PublicationHistoryEntry>[];
}> = ({ entries }) => (
  <details className="space-y-2">
    <summary className={`${SECTION_HEADING} cursor-pointer select-none`}>
      History
    </summary>
    <PublicationHistory entries={entries} />
  </details>
);

const EditField: FC<{ id: PublicationId; attribute: PublicationKey }> = ({
  id,
  attribute,
}) => {
  const store = usePublicationStore();
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
        onValidate={() => validateUpdate(store, id)}
      />
    </div>
  );
};

const PublicationEditForm: FC<{
  id: PublicationId;
  onSaved: () => void;
  onCancel: () => void;
}> = ({ id, onSaved, onCancel }) => {
  const store = usePublicationStore();
  const [saving, setSaving] = useState(false);
  const error = usePublicationErrorDescription(id);
  const isValid = useIsPublicationValid(id);
  const references = usePublicationReferences(id);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await update(store, id);
    setSaving(false);
    if (saved) onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      <SectionHeading>Edit publication</SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        {Publication.ATTRIBUTES.map((attribute) => (
          <EditField key={attribute} id={id} attribute={attribute} />
        ))}
      </div>
      <ReferencesEditor
        value={references}
        onChange={(next) => overrideReferences(store, id, next)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        <Button
          label="Cancel"
          variant="outline"
          width="fit"
          size="medium"
          onClick={onCancel}
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

/**
 * A publication as a reader sees it: the title and its translators, a sentence
 * placing it, and its sources — plus, for an admin, its history and the controls
 * to correct or remove it.
 *
 * Takes the record — and the log behind it — rather than an id, so whoever
 * renders it decides where those came from, and the view is complete the moment
 * it appears instead of filling in afterwards. Who may do what is settled here
 * rather than by each caller, so the same publication offers the same
 * affordances wherever it is read.
 *
 * A save asks the server to render again: the heading, the breadcrumb, and the
 * page title are drawn from the same record by whoever placed this view, and
 * re-reading is the only way they cannot disagree with the body.
 */
type PublicationDetailProps = {
  publication: Publication;
  /**
   * The record's mutation log, read alongside it. Present only for an admin,
   * who is the only reader allowed it.
   */
  history?: WithChanges<PublicationHistoryEntry>[];
  /**
   * Run once the record is gone. Defaults to leaving for the index, which is
   * what a page showing only this publication has to do; an overlay closes
   * instead and leaves the database behind it in place.
   */
  onDeleted?: () => void;
};

const PublicationDetail: FC<PublicationDetailProps> = (props) => (
  <PublicationStoreProvider>
    <Detail {...props} />
  </PublicationStoreProvider>
);

const Detail: FC<PublicationDetailProps> = ({
  publication,
  history,
  onDeleted,
}) => {
  const id = publication.id!;
  const store = usePublicationStore();
  const canEdit = useCanEditPublications();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const deleteConfirmation = useModal();
  const [deleting, setDeleting] = useState(false);

  // An edit abandoned by closing the view is dropped, not kept: the overlay it
  // writes to is the same one the row behind it reads around.
  useEffect(
    () => (editing ? () => discardEdit(store, id) : undefined),
    [editing, id, store],
  );

  function startEditing() {
    // The form edits the store's copy of the record, so a view that read it on
    // the server has to hand it over before the fields can show anything.
    remember(store, publication);
    setEditing(true);
  }

  function handleSaved() {
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const removed = await deletePublication(store, {
      id,
      title: publication.title,
    });
    setDeleting(false);
    deleteConfirmation.close();

    if (removed) {
      // Whatever was showing this record — the database underneath an overlay,
      // or this page — was drawn before it left. Ask for it again, then leave.
      router.refresh();
      (onDeleted ?? (() => router.replace("/")))();
    }
  }

  return (
    <div className="space-y-6">
      {editing ? (
        <PublicationEditForm
          id={id}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <PublicationDescription publication={publication} />
          <PublicationReferences references={publication.references} />
          {history && <PublicationHistorySection entries={history} />}
          {canEdit && (
            <div className="flex gap-3">
              <Button
                label="Edit"
                variant="outline-primary"
                width="fit"
                size="medium"
                onClick={startEditing}
              />
              <Button
                label="Delete"
                variant="danger"
                width="fit"
                size="medium"
                onClick={() => deleteConfirmation.open()}
              />
            </div>
          )}
        </>
      )}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Delete this publication?"
        message={`“${publication.title}” (${publication.year}) will be removed from the database, its index, and search results.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={deleteConfirmation.close}
      />
    </div>
  );
};

export default PublicationDetail;
export { PublicationHeading };
