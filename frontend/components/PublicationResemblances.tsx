"use client";

import { Candidate } from "components/DuplicateReview";
import {
  usePublicationResemblance,
  useVisiblePublication,
} from "modules/publication/hooks";
import type { PublicationId } from "modules/publication/model";
import { resemblingIdsAtom } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import ModalHeading from "./ModalHeading";
import SectionHeading from "./SectionHeading";

type Props = {
  isOpen: boolean;
  /** The row to open on. Defaults to the first question of the queue. */
  startAt?: PublicationId;
  onClose: () => void;
};

/**
 * One row set against everything it resembles, whether that is a stored record
 * or another row of the same import. Both are the same evidence, so both are
 * read the same way.
 *
 * It says what it found and stops there. What to do about it — correcting the
 * row, discarding it, leaving it alone because two editions of one book are two
 * publications — is done to the row in the workspace, with the controls that
 * already do those things.
 */
const Question: FC<{
  id: PublicationId;
  position: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
}> = ({ id, position, total, onPrevious, onNext }) => {
  const t = useTranslations("resemblances");
  const common = useTranslations("common");
  const row = useVisiblePublication(id);
  const resemblance = usePublicationResemblance(id);
  const stored = resemblance?.stored.length ?? 0;
  const rows = resemblance?.others.length ?? 0;

  return (
    <div className="flex flex-col gap-6 p-8 w-full min-h-full">
      <ModalHeading
        heading={row.title}
        subheading={
          <>
            {stored > 0 && t("looksLikeStored", { count: stored })}{" "}
            {rows > 0 && t("looksLikeRows", { count: rows })}
          </>
        }
        aside={common("progress", { position: position + 1, total })}
      />

      <section className="space-y-2">
        <SectionHeading>{t("beingImported")}</SectionHeading>
        <Candidate publication={row} />
      </section>

      {stored > 0 && (
        <section className="space-y-2">
          <SectionHeading>{t("alreadyStored")}</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {resemblance?.stored.map((publication) => (
              <Candidate key={publication.id} publication={publication} />
            ))}
          </div>
        </section>
      )}

      {rows > 0 && (
        <section className="space-y-2">
          <SectionHeading>{t("elsewhereInImport")}</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {resemblance?.others.map((other) => (
              <OtherRow key={other} id={other} />
            ))}
          </div>
        </section>
      )}

      {total === 1 ? null : (
        <div className="flex flex-wrap gap-3 justify-end mt-auto">
          <Button
            label={t("previous")}
            variant="outline"
            width="fit"
            size="medium"
            disabled={!onPrevious}
            onClick={onPrevious}
          />
          <Button
            label={t("next")}
            variant="outline-primary"
            width="fit"
            size="medium"
            disabled={!onNext}
            onClick={onNext}
          />
        </div>
      )}
    </div>
  );
};

/** Another row of the same import, read as the evidence it is. */
const OtherRow: FC<{ id: PublicationId }> = ({ id }) => {
  const row = useVisiblePublication(id);

  return <Candidate publication={row} />;
};

/**
 * The rows that look like something, read one at a time.
 *
 * The dialog renders its content only while it is open, so this mounts on
 * opening, and the list it steps through is taken then. Editing a row while the
 * dialog is over it would otherwise renumber the reader's place mid-read.
 */
const Queue: FC<{ startAt?: PublicationId }> = ({ startAt }) => {
  const store = usePublicationStore();

  const [queue] = useState(() => store.get(resemblingIdsAtom) ?? []);

  // Opened from a row's own warning the reading starts on that row; opened from
  // the count, at the beginning.
  const [position, setPosition] = useState(() =>
    Math.max(0, queue.indexOf(startAt as PublicationId)),
  );

  const current = queue[position];

  return current === undefined ? null : (
    <div className="overflow-y-auto flex-1">
      <Question
        // Keyed by the row, so each is read afresh.
        key={current}
        id={current}
        position={position}
        total={queue.length}
        onPrevious={
          position === 0 ? undefined : () => setPosition(position - 1)
        }
        onNext={
          position === queue.length - 1
            ? undefined
            : () => setPosition(position + 1)
        }
      />
    </div>
  );
};

const PublicationResemblances: FC<Props> = ({ isOpen, startAt, onClose }) => {
  const t = useTranslations("resemblances");

  return (
    <Modal isOpen={isOpen} onClose={onClose} label={t("label")}>
      <div className="flex flex-col w-full h-full sm:h-[70vh]">
        <Queue startAt={startAt} />
      </div>
    </Modal>
  );
};

export default PublicationResemblances;
export type { Props as PublicationResemblancesProps };
