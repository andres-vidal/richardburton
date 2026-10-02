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
  /** The row to open on. Defaults to the first row in the queue. */
  startAt?: PublicationId;
  onClose: () => void;
};

/**
 * Shows one row being imported next to everything it resembles: stored
 * records, other rows of the same import, or both. Every record and row is
 * shown with the same `Candidate` card.
 *
 * It has no controls that change the row. The person corrects or discards the
 * row in the workspace with the existing controls, or leaves it as it is, since
 * two editions of one book are two publications.
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

/** Shows another row of the same import as a `Candidate` card. */
const OtherRow: FC<{ id: PublicationId }> = ({ id }) => {
  const row = useVisiblePublication(id);

  return <Candidate publication={row} />;
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
