"use client";

import RestoreTrashIcon from "assets/restore-trash.svg";
import { Candidate } from "components/DuplicateReview";
import { PublicationEditForm } from "components/PublicationDetail";
import {
  type DeletedPublicationEntry,
  type Publication,
  type PublicationId,
} from "modules/publication/model";
import { useFormatDate } from "modules/dates";
import {
  usePublicationMarking,
  useVisiblePublication,
} from "modules/publication/hooks";
import { restore, type Restoration } from "modules/publication/remote";
import {
  publicationFamily,
  remember,
  setErrors,
} from "modules/publication/store";
import { PublicationStoreProvider } from "modules/publication/workspace";
import type { Store } from "modules/store";
import { useRouter } from "i18n/navigation";
import { createStore } from "jotai";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import ModalHeading from "./ModalHeading";
import SectionHeading from "./SectionHeading";

type Restore = (
  id: PublicationId,
  changes?: Publication,
) => Promise<Restoration>;

/** A deleted publication whose restore was refused, and the publication that
 * has its identity. */
type Refused = { deleted: Publication; twin: Publication };

/**
 * Offers to restore `deleted` with changes, after a restore was refused
 * because `twin`, a publication that is not deleted, has the same identity.
 *
 * It shows `twin` compared with the deleted publication as it is edited, so
 * the words that come to differ are highlighted, and the edit form for the
 * deleted publication in a store of its own. The form starts with the conflict
 * as its error, so it can be saved only once a change has passed validation.
 * Saving restores the publication with the changes. When the server answers
 * that another publication is identical, that one is shown instead.
 */
const RestoreWithChanges: FC<
  Refused & { onRestore: Restore; onRestored: () => void; onClose: () => void }
> = ({ deleted, ...props }) => {
  // The edit is kept in a store of its own, passed explicitly so that it never
  // joins the store of an enclosing surface.
  const [store] = useState(() => {
    const own = createStore();

    remember(own, deleted);
    setErrors(own, [
      { id: deleted.id!, publication: deleted, errors: "conflict" },
    ]);

    return own;
  });

  return (
    <PublicationStoreProvider store={store}>
      <Changing deleted={deleted} {...props} />
    </PublicationStoreProvider>
  );
};

// The body of `RestoreWithChanges`, inside the store that holds the edit.
const Changing: FC<
  Refused & { onRestore: Restore; onRestored: () => void; onClose: () => void }
> = ({ deleted, twin: refusedBy, onRestore, onRestored, onClose }) => {
  const t = useTranslations("restoring");
  const id = deleted.id!;
  const edited = useVisiblePublication(id);
  const [twin, setTwin] = useState(refusedBy);

  async function save(store: Store, at: PublicationId) {
    const changes = store.get(publicationFamily(at));
    const result = await onRestore(at, changes);

    if (result.outcome === "identical") {
      setTwin(result.twin);
      setErrors(store, [{ id: at, publication: changes, errors: "conflict" }]);
    }

    return result.outcome === "restored";
  }

  return (
    <div className="flex flex-col gap-6 p-8 w-full">
      <ModalHeading
        heading={t("identical")}
        subheading={t("identicalDetail")}
      />
      <section className="space-y-2">
        <SectionHeading>{t("alreadyStored")}</SectionHeading>
        <p className="text-sm text-gray-600">{t("differences")}</p>
        <Candidate publication={twin} others={[edited]} />
      </section>
      <PublicationEditForm
        id={id}
        save={save}
        onSaved={onRestored}
        onCancel={onClose}
        heading={t("thisOne")}
        saveLabel={t("restoreWithChanges")}
      />
    </div>
  );
};

/**
 * The trash: soft-deleted publications, most recently deleted first, each
 * restorable with one click — restoring is not destructive, so no confirmation
 * stands in the way.
 *
 * A restore is refused when another publication that is not deleted has the
 * same identity. The list then opens `RestoreWithChanges`, where the
 * publication can be changed so the two differ, and restored with the changes.
 *
 * A successful restore asks the server to render the list again rather than
 * editing it here.
 */
const DeletedPublications: FC<{
  entries: DeletedPublicationEntry[];
  onRestore?: Restore;
}> = ({ entries, onRestore = restore }) => {
  const t = useTranslations("admin");
  const restoring = useTranslations("restoring");
  const marked = usePublicationMarking();
  const formatDate = useFormatDate();
  const [restoringId, setRestoringId] = useState<PublicationId>();
  const [refused, setRefused] = useState<Refused | null>(null);
  const router = useRouter();

  async function handleRestore(deleted: Publication) {
    setRestoringId(deleted.id!);
    try {
      const result = await onRestore(deleted.id!);

      if (result.outcome === "restored") router.refresh();
      if (result.outcome === "identical") {
        setRefused({ deleted, twin: result.twin });
      }
    } finally {
      setRestoringId(undefined);
    }
  }

  function handleRestored() {
    setRefused(null);
    router.refresh();
  }

  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-600">{t("nothingDeleted")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(({ publication, deletedAt }) => (
            <li
              key={publication.id}
              className="flex gap-4 items-center p-4 bg-white rounded-lg border border-gray-200"
            >
              <div className="flex flex-col gap-0.5 min-w-0 grow">
                <span className="font-medium text-gray-800 truncate">
                  {publication.title}
                </span>
                <span className="text-sm text-gray-600 truncate">
                  {t("recordLine", {
                    authors: marked.value(publication, "authors"),
                    year: publication.year,
                    publishers: marked.value(publication, "publishers"),
                  })}
                </span>
                <span className="text-xs text-gray-500">
                  {t("deletedOn", { date: formatDate(deletedAt) })}
                </span>
              </div>
              <Button
                label={t("restore")}
                variant="outline-primary"
                width="fit"
                size="medium"
                Icon={RestoreTrashIcon}
                loading={restoringId === publication.id}
                disabled={restoringId !== undefined}
                onClick={() => handleRestore(publication)}
              />
            </li>
          ))}
        </ul>
      )}
      <Modal
        isOpen={refused !== null}
        onClose={() => setRefused(null)}
        label={restoring("identical")}
      >
        {refused ? (
          <RestoreWithChanges
            key={refused.deleted.id}
            deleted={refused.deleted}
            twin={refused.twin}
            onRestore={onRestore}
            onRestored={handleRestored}
            onClose={() => setRefused(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
};

export default DeletedPublications;
