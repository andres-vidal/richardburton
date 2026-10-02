"use client";

import { Candidate } from "components/DuplicateReview";
import {
  usePublicationResemblance,
  useVisiblePublication,
  useVisiblePublications,
} from "modules/publication/hooks";
import type { Publication, PublicationId } from "modules/publication/model";
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
  /** The row to open on. Defaults to the first row in the queue. */
  startAt?: PublicationId;
  onClose: () => void;
};

/** Used while a row resembles no other row, so the list keeps its identity. */
const NO_ROWS: PublicationId[] = [];

/**
 * Shows one row being imported next to everything it resembles: stored
 * records, other rows of the same import, or both. Every record and row is
 * shown with the same `Candidate` card, compared with every other card of the
 * question, so the words that differ between them are highlighted.
 *
 * It has no controls that change the row. The person corrects or discards the
 * row in the workspace with the existing controls, or leaves it as it is, since
 * a row that leaves out its year, country or publisher can resemble another
 * edition of its book.
 *
 * Another row that has left the document since the check is not shown.
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
  const storedRecords = resemblance?.stored ?? [];
  const otherIds = resemblance?.others ?? NO_ROWS;
  const otherRows = useVisiblePublications(otherIds)
    .map((publication, index) => ({ id: otherIds[index], publication }))
    .filter(({ publication }) => publication !== undefined);
  const stored = storedRecords.length;
  const rows = otherRows.length;

  const group = [
    row,
    ...storedRecords,
    ...otherRows.map(({ publication }) => publication),
  ];
  const othersOf = (publication: Publication) =>
    group.filter((other) => other !== publication);

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
        <Candidate publication={row} others={othersOf(row)} />
      </section>

      {stored > 0 && (
        <section className="space-y-2">
          <SectionHeading>{t("alreadyStored")}</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {storedRecords.map((publication) => (
              <Candidate
                key={publication.id}
                publication={publication}
                others={othersOf(publication)}
              />
            ))}
          </div>
        </section>
      )}

      {rows > 0 && (
        <section className="space-y-2">
          <SectionHeading>{t("elsewhereInImport")}</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {otherRows.map(({ id: other, publication }) => (
              <Candidate
                key={other}
                publication={publication}
                others={othersOf(publication)}
              />
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

/**
 * Steps through the rows that resemble something, one at a time.
 *
 * `Modal` renders its content only while it is open, so `Queue` mounts when the
 * review opens. It copies `resemblingIdsAtom` then and keeps that list until
 * the review closes. If it read the live list, an edit made while the review is
 * open could change the list and move the current position.
 */
const Queue: FC<{ startAt?: PublicationId }> = ({ startAt }) => {
  const store = usePublicationStore();

  const [queue] = useState(() => store.get(resemblingIdsAtom) ?? []);

  // Starts on `startAt` if it is in the queue, and on the first row otherwise.
  const [position, setPosition] = useState(() =>
    Math.max(0, queue.indexOf(startAt as PublicationId)),
  );

  const current = queue[position];

  return current === undefined ? null : (
    <div className="overflow-y-auto flex-1">
      <Question
        // Keyed by the row id, so `Question` remounts for each row.
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
