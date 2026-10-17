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
  type FollowedPublication,
  Publication,
  type PublicationHistoryEntry,
  type PublicationId,
  type PublicationKey,
  type PublicationKind as Kind,
  type PublicationListKey,
  searchHref,
} from "modules/publication/model";
import { watchEdit } from "modules/publication/checks";
import { deletePublication, update } from "modules/publication/remote";
import { discardEdit, remember, setSources } from "modules/publication/store";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import { useCountryNaming } from "modules/country-names";
import { isBlank, type RichTextValue } from "modules/rich-text";
import type { Store } from "modules/store";
import { useCanEditPublications } from "modules/session";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "i18n/navigation";
import {
  FC,
  Fragment,
  ReactNode,
  SubmitEvent,
  useEffect,
  useState,
} from "react";
import { useMutation } from "utils/useMutation";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import DataInput from "./DataInput";
import Highlight from "./Highlight";
import { useModal } from "./Modal";
import NotesField from "./NotesField";
import PublicationHistory from "./PublicationHistory";
import PublicationKind from "./PublicationKind";
import PublicationMerge from "./PublicationMerge";
import RichText from "./RichText";
import SourcesEditor from "./SourcesEditor";
import SectionHeading, { SECTION_HEADING } from "./SectionHeading";
import Tooltip from "./Tooltip";

/** `label`, marked where the search matched, as a link to a search for `value`. */
const Searchable: FC<{ label: string; value: string }> = ({ value, label }) => (
  <Link href={searchHref(value)} className="anchor">
    <Highlight>{label}</Highlight>
  </Link>
);

/**
 * Renders `items` as a sentence lists them: "A, B and C". The formatter of the
 * locale supplies the commas and the final conjunction, which differ by
 * language.
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

/**
 * The heading of a publication: its title and, in brackets, its translators,
 * each with a tooltip that says what it is.
 */
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

/**
 * A sentence that places the publication: its original book and authors, its
 * translators, and where, when and by whom it was published. Every name in it
 * links to a search for that name, and a country links to a search for its
 * code.
 */
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
              <span className="min-w-0 wrap-break-word">
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
 * The publication's notes under their heading, rendered with `RichText`, as a
 * region named for them. It renders nothing for a publication whose notes are
 * missing, null or blank.
 */
const PublicationNotes: FC<{ notes: RichTextValue | null | undefined }> = ({
  notes,
}) => {
  const t = useTranslations("attributes");

  return isBlank(notes) ? null : (
    <section aria-label={t("notes")} className="space-y-2">
      <SectionHeading>{t("notes")}</SectionHeading>
      <RichText value={notes} />
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

/**
 * The field for `attribute` of the publication `id`, under its label. It writes
 * its error under itself, since a form has room for it.
 */
const EditField: FC<{ id: PublicationId; attribute: PublicationKey }> = ({
  id,
  attribute,
}) => {
  const t = useTranslations("attributes");
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
        errorDisplay="inline"
      />
    </div>
  );
};

/**
 * A form that edits every field of the publication `id` in the enclosing store,
 * and saves it with `save`. While the form is open, `watchEdit` validates the
 * publication shortly after each change.
 *
 * `save` defaults to `update`, which saves the edit to the database. It returns
 * whether the save succeeded. Only then does `onSaved` run, and the page is
 * read again from the server. The save button is disabled while the
 * publication has errors, since the server would refuse it, and while a save
 * runs. `heading` and `saveLabel` replace the form's heading and the save
 * button's label.
 */
const PublicationEditForm: FC<{
  id: PublicationId;
  onSaved: () => void;
  onCancel: () => void;
  save?: (store: Store, id: PublicationId) => Promise<boolean>;
  heading?: string;
  saveLabel?: string;
}> = ({ id, onSaved, onCancel, save = update, heading, saveLabel }) => {
  const t = useTranslations("publication");
  const store = usePublicationStore();
  const { pending: saving, run } = useMutation();
  const error = usePublicationErrorDescription(id);
  const isValid = useIsPublicationValid(id);
  const sources = usePublicationSources(id);

  useEffect(() => watchEdit(store, id), [store, id]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const saved = await save(store, id);
      if (saved) onSaved();
      return saved;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      <SectionHeading>{heading ?? t("editPublication")}</SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        {Publication.ATTRIBUTES.map((attribute) => (
          <EditField key={attribute} id={id} attribute={attribute} />
        ))}
      </div>
      <SourcesEditor
        value={sources}
        onChange={(next) => setSources(store, id, next)}
      />
      <NotesField id={id} />
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
          label={saveLabel ?? t("save")}
          type="submit"
          width="fit"
          size="medium"
          loading={saving}
          disabled={!isValid}
        />
      </div>
    </form>
  );
};

type PublicationDetailProps = {
  publication: Publication;
  /** The publication's kind, read with it. */
  kind: Kind;
  /** The publications it follows, read with it, none for a first translation. */
  follows: FollowedPublication[];
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

/**
 * A publication as a reader sees it: a line that says whether it is a
 * retranslation or a reissue, a sentence placing it, its notes and its
 * sources.
 * Whoever may edit publications also gets the controls to edit, merge and
 * delete it, and `history`, when given, is shown in a collapsed section. The
 * view keeps its edits in a publication store of its own, or in the enclosing
 * one.
 *
 * It takes the record, its kind and its log rather than an id, so it reads
 * nothing and is complete when it first renders. A save or a merge reads the
 * page again from the server, so the heading and the page title, which are
 * drawn from the same record elsewhere on the page, agree with it.
 */
const PublicationDetail: FC<PublicationDetailProps> = (props) => (
  <PublicationStoreProvider>
    <Detail {...props} />
  </PublicationStoreProvider>
);

// The body of `PublicationDetail`: the reader's view, or the edit form while
// editing, and the merge and delete dialogs.
const Detail: FC<PublicationDetailProps> = ({
  publication,
  kind,
  follows,
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
  const { pending: deleting, run } = useMutation();
  const mergeDialog = useModal();

  // When editing ends or the view closes, `discardEdit` drops any unsaved edit.
  // The row goes back to the way it was saved, and its errors are cleared.
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

  // Deletes the publication. When that succeeds, `run` reads the page again,
  // since whatever shows the record was drawn before it left, and then the view
  // leaves through `onDeleted`.
  async function handleDelete() {
    const removed = await run(async () => {
      const removed = await deletePublication(store, {
        id,
        title: publication.title,
      });
      deleteConfirmation.close();
      return removed;
    });

    if (removed) (onDeleted ?? (() => router.replace("/")))();
  }

  return (
    <div className="space-y-6">
      {editing ? (
        <PublicationEditForm
          id={id}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <PublicationKind kind={kind} follows={follows} />
          <PublicationDescription publication={publication} />
          <PublicationNotes notes={publication.notes} />
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
export { PublicationEditForm, PublicationHeading };
