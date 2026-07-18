"use client";

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
  type PublicationId,
  type PublicationKey,
} from "modules/publication/model";
import { update, validateUpdate } from "modules/publication/remote";
import { discardEdit, overrideReferences } from "modules/publication/store";
import { useIsAdmin } from "modules/session";
import Link from "next/link";
import { FC, SubmitEvent, useState } from "react";
import { z } from "zod";
import { Article } from "./Article";
import Button from "./Button";
import DataInput from "./DataInput";
import { Modal, useURLQueryModal } from "./Modal";
import ReferencesEditor from "./ReferencesEditor";
import Tooltip from "./Tooltip";

const PUBLICATION_MODAL_KEY = "publication";

const Param = z.string().regex(/^\d+$/).transform(Number).optional();
type Param = z.infer<typeof Param>;

const Searchable: FC<{ label: string; value?: string }> = ({
  value,
  label,
}) => {
  const { close } = useURLQueryModal(PUBLICATION_MODAL_KEY);
  return (
    <Link
      href={`/?search=${value || label}`}
      className="anchor"
      onClick={close}
    >
      {label}
    </Link>
  );
};

const SearchableList: FC<{ items: { label: string; value?: string }[] }> = ({
  items,
}) => (
  <ul className="contents">
    {items.map((item, index) => (
      <li key={item.value} className="contents">
        {index != 0 && index === items.length - 1 && " and "}
        <Searchable {...item} />
        {index < items.length - 2 && ", "}
        {index === items.length - 1 && " "}
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
  // `value` (not `id`): it's the field SearchableList keys on and Searchable
  // searches by. Naming it `id` left `value` undefined — a duplicate-key warning
  // and links that searched the human label (e.g. "United States of America")
  // instead of the raw value ("US").
  function getSearchableItems(p: Publication, key: PublicationKey) {
    return p[key]
      .split(",")
      .map((value) => value.trim())
      .map((value) => ({
        value,
        label: Publication.describeValue(value, key),
      }));
  }

  // A <div>, not a <p>: SearchableList renders a <ul>, which is invalid (and a
  // hydration error) nested inside a paragraph.
  return (
    <div>
      <Searchable label={p.title} /> is a translation of{" "}
      <Searchable label={p.originalTitle} />, by{" "}
      <SearchableList items={getSearchableItems(p, "originalAuthors")} />. It
      was written by <SearchableList items={getSearchableItems(p, "authors")} />{" "}
      and published in{" "}
      <SearchableList items={getSearchableItems(p, "countries")} />
      in {p.year} by{" "}
      <SearchableList items={getSearchableItems(p, "publishers")} />.
    </div>
  );
};

const PublicationReferences: FC<{ references: string[] }> = ({ references }) =>
  references.length === 0 ? null : (
    <section className="space-y-2">
      <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase">
        References
      </h2>
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
    </section>
  );

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

  function close() {
    if (editing && publicationId !== undefined) discardEdit(publicationId);
    modal.close();
  }

  return (
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
              <div className="space-y-6">
                <PublicationDescription publication={publication} />
                <PublicationReferences references={publication.references} />
                {isAdmin && (
                  <Button
                    label="Edit"
                    variant="outline-primary"
                    width="fit"
                    size="medium"
                    onClick={() => setEditingId(publicationId)}
                  />
                )}
              </div>
            }
          />
        ))}
    </Modal>
  );
};

export { PUBLICATION_MODAL_KEY, PublicationModal };
