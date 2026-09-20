"use client";

import type { WithChanges } from "modules/publication/history";
import {
  useIsPublicationValid,
  usePublicationErrorDescription,
  usePublicationField,
  usePublicationFieldError,
  usePublicationMarking,
  usePublicationSources,
} from "modules/publication/hooks";
import {
  Publication,
  type PublicationHistoryEntry,
  type PublicationId,
  type PublicationKey,
  type PublicationListKey,
} from "modules/publication/model";
import {
  deletePublication,
  update,
  validateUpdate,
} from "modules/publication/remote";
import {
  discardEdit,
  overrideSources,
  remember,
} from "modules/publication/store";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import { useCountryNaming } from "modules/country-names";
import { useCanEditPublications } from "modules/session";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "i18n/navigation";
import { useRouter } from "i18n/navigation";
import {
  FC,
  Fragment,
  ReactNode,
  SubmitEvent,
  useEffect,
  useState,
} from "react";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import DataInput from "./DataInput";
import Highlight from "./Highlight";
import { useModal } from "./Modal";
import PublicationHistory from "./PublicationHistory";
import PublicationMerge from "./PublicationMerge";
import SourcesEditor from "./SourcesEditor";
import SectionHeading, { SECTION_HEADING } from "./SectionHeading";
import Tooltip from "./Tooltip";

const Searchable: FC<{ label: string; value: string }> = ({ value, label }) => (
  <Link href={`/?search=${value}`} className="anchor">
    <Highlight>{label}</Highlight>
  </Link>
);

/**
 * Several things read as one sentence would say them: "A, B and C".
 *
 * `Intl.ListFormat` supplies the commas and the final conjunction, which differ
 * by language.
 */
const SentenceList: FC<{ items: { key: string; node: ReactNode }[] }> = ({
  items,
}) => {
  const format = useFormatter();

  return (
    <>
      {format.list(
        items.map((item) => <Fragment key={item.key}>{item.node}</Fragment>),
      )}
    </>
  );
};

const PublicationHeading: FC<{ publication: Publication }> = ({
  publication,
}) => {
  const t = useTranslations("publication");
  const marked = usePublicationMarking();

  return (
    <div className="flex flex-col w-full min-w-0 text-2xl font-normal sm:gap-2 sm:items-center sm:flex-row">
      <Tooltip variant="info" message={t("translationTitle")}>
        <span className="w-full min-w-0 truncate">
          <Highlight>{marked.value(publication, "title")}</Highlight>
        </span>
      </Tooltip>
      <Tooltip variant="info" message={t("whoTranslated")}>
        <span className="text-lg font-light tracking-tighter text-indigo-500 truncate sm:text-xl sm:shrink-0">
          (<Highlight>{marked.value(publication, "authors")}</Highlight>)
        </span>
      </Tooltip>
    </div>
  );
};

const PublicationDescription: FC<{ publication: Publication }> = ({
  publication: p,
}) => {
  const t = useTranslations("publication");
  const marked = usePublicationMarking();
  const naming = useCountryNaming();

  const list = (key: PublicationListKey) =>
    function List() {
      return (
        <SentenceList
          items={marked.items(p, key).map((item) => ({
            key: item.value,
            node: <Searchable {...item} />,
          }))}
        />
      );
    };

  function Countries() {
    const items = marked.items(p, "countries").map((country) => ({
      key: country.value,
      node: t.rich("inCountry", {
        article: naming.article(country.value),
        name: () => <Searchable {...country} />,
      }),
    }));

    return <SentenceList items={items} />;
  }

  return (
    <div>
      {t.rich("description", {
        title: () => (
          <Searchable value={p.title} label={marked.value(p, "title")} />
        ),
        originalTitle: () => (
          <Searchable
            value={p.originalTitle}
            label={marked.value(p, "originalTitle")}
          />
        ),
        originalAuthors: list("originalAuthors"),
        authors: list("authors"),
        countries: Countries,
        publishers: list("publishers"),
        year: p.year,
        // Portuguese names the publishers before listing them, so the sentence
        // has to agree with how many there are.
        publisherCount: p.publishers?.length ?? 0,
      })}
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
const PublicationSources: FC<{ sources: string[] }> = ({ sources }) => {
  const t = useTranslations("publication");

  return (
    <section className="space-y-2">
      <SectionHeading>{t("sources")}</SectionHeading>
      {sources.length === 0 ? (
        <p className="text-xs text-gray-500">{t("noSources")}</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-gray-700">
          {sources.map((source, index) => (
            <li key={index} className="flex gap-2.5 items-baseline">
              <span
                aria-hidden
                className="size-1.5 rounded-full shrink-0 bg-indigo-400 ring-2 ring-indigo-100"
              />
              <span className="wrap-break-words">
                <Highlight>{source}</Highlight>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/**
 * The record's mutation log, collapsed. The entries arrive with the record, so
 * expanding it costs nothing and shows everything at once.
 */
const PublicationHistorySection: FC<{
  entries: WithChanges<PublicationHistoryEntry>[];
}> = ({ entries }) => {
  const t = useTranslations("publication");

  return (
    <details className="space-y-2">
      <summary className={`${SECTION_HEADING} cursor-pointer select-none`}>
        {t("history")}
      </summary>
      <PublicationHistory entries={entries} />
    </details>
  );
};

const EditField: FC<{ id: PublicationId; attribute: PublicationKey }> = ({
  id,
  attribute,
}) => {
  const t = useTranslations("attributes");
  const store = usePublicationStore();
  const value = usePublicationField(id, attribute);
  const error = usePublicationFieldError(id, attribute);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-gray-500">{t(attribute)}</span>
      <DataInput
        rowId={id}
        colId={attribute}
        value={value}
        error={error}
        aria-label={t(attribute)}
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
  const t = useTranslations("publication");
  const store = usePublicationStore();
  const [saving, setSaving] = useState(false);
  const error = usePublicationErrorDescription(id);
  const isValid = useIsPublicationValid(id);
  const sources = usePublicationSources(id);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await update(store, id);
    setSaving(false);
    if (saved) onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      <SectionHeading>{t("editPublication")}</SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        {Publication.ATTRIBUTES.map((attribute) => (
          <EditField key={attribute} id={id} attribute={attribute} />
        ))}
      </div>
      <SourcesEditor
        value={sources}
        onChange={(next) => overrideSources(store, id, next)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        <Button
          label={t("cancel")}
          variant="outline"
          width="fit"
          size="medium"
          onClick={onCancel}
        />
        <Button
          label={t("save")}
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
  const t = useTranslations("publication");
  const id = publication.id!;
  const store = usePublicationStore();
  const canEdit = useCanEditPublications();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const deleteConfirmation = useModal();
  const [deleting, setDeleting] = useState(false);
  const mergeDialog = useModal();

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
          <PublicationSources
            sources={Publication.markedSources(publication)}
          />
          {history && <PublicationHistorySection entries={history} />}
          {canEdit && (
            <div className="flex gap-3">
              <Button
                label={t("edit")}
                variant="outline-primary"
                width="fit"
                size="medium"
                onClick={startEditing}
              />
              <Button
                label={t("merge")}
                variant="outline"
                width="fit"
                size="medium"
                onClick={() => mergeDialog.open()}
              />
              <Button
                label={t("delete")}
                variant="danger"
                width="fit"
                size="medium"
                onClick={() => deleteConfirmation.open()}
              />
            </div>
          )}
        </>
      )}
      <PublicationMerge
        publication={publication}
        isOpen={mergeDialog.isOpen}
        onClose={mergeDialog.close}
        onMerged={() => {
          mergeDialog.close();
          router.refresh();
        }}
      />
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title={t("deleteTitle")}
        message={t("deleteMessage", {
          title: publication.title,
          year: publication.year,
        })}
        confirmLabel={t("delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={deleteConfirmation.close}
      />
    </div>
  );
};

export default PublicationDetail;
export { PublicationHeading };
