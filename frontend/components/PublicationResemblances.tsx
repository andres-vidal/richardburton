"use client";

import { Candidate } from "components/DuplicateReview";
import {
  usePublicationResemblance,
  useResemblingPublicationIds,
  useVisiblePublication,
} from "modules/publication/hooks";
import type { PublicationId } from "modules/publication/model";
import { acceptResemblance, setDiscarded } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC, useEffect, useState } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import SectionHeading from "./SectionHeading";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * One row's question: this row looks like something — is it the same
 * publication?
 *
 * The row is shown against everything it resembles, whether that is a stored
 * record or another row of the same import. Both are the same evidence, so both
 * are read the same way.
 */
const Question: FC<{
  id: PublicationId;
  position: number;
  total: number;
  onKeep: () => void;
  onDiscard: () => void;
}> = ({ id, position, total, onKeep, onDiscard }) => {
  const t = useTranslations("resemblances");
  const common = useTranslations("common");
  const row = useVisiblePublication(id);
  const resemblance = usePublicationResemblance(id);
  const stored = resemblance?.stored.length ?? 0;
  const rows = resemblance?.others.length ?? 0;

  return (
    <div className="flex flex-col gap-6 p-8 w-full min-h-full">
      <div className="flex gap-4 justify-between items-baseline pb-4 border-b border-gray-200">
        <div className="min-w-0">
          <h2 className="text-xl truncate">{row.title}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {stored > 0 && t("looksLikeStored", { count: stored })}{" "}
            {rows > 0 && t("looksLikeRows", { count: rows })}
          </p>
        </div>
        <span className="text-sm text-gray-600 shrink-0 tabular-nums">
          {common("progress", { position: position + 1, total })}
        </span>
      </div>

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

      <div className="flex flex-wrap gap-3 justify-end mt-auto">
        <Button
          label={t("discard")}
          variant="danger"
          width="fit"
          size="medium"
          onClick={onDiscard}
        />
        <Button
          label={t("keep")}
          variant="outline-primary"
          width="fit"
          size="medium"
          onClick={onKeep}
        />
      </div>
    </div>
  );
};

/** Another row of the same import, read as the evidence it is. */
const OtherRow: FC<{ id: PublicationId }> = ({ id }) => {
  const row = useVisiblePublication(id);

  return <Candidate publication={row} />;
};

/**
 * Step through the rows of an import that look like something already known.
 *
 * Nothing here is a decision the database keeps. A row is either dropped from
 * the import or kept in it, and keeping it only stops the question being asked
 * again in this workspace — two editions of one book resemble each other and
 * are both worth having.
 */
const PublicationResemblances: FC<Props> = ({ isOpen, onClose }) => {
  const t = useTranslations("resemblances");
  const store = usePublicationStore();
  const raised = useResemblingPublicationIds() ?? [];

  // The questions as they stood when the dialog opened. Answering one takes the
  // row out of `raised`, and stepping through a list that shrinks underneath
  // would renumber the progress after every answer.
  const [queue, setQueue] = useState<PublicationId[]>([]);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQueue(raised);
      setPosition(0);
    }
    // Only the opening is the moment to snapshot; `raised` changes as the
    // questions are answered, which is exactly what must not restart the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const current = queue[position];

  function answer(answered: () => void) {
    answered();
    setPosition((at) => at + 1);
  }

  function handleClose() {
    setPosition(0);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} label={t("label")}>
      <div className="flex flex-col w-full h-full sm:h-[70vh]">
        {current === undefined ? (
          <div className="flex flex-col gap-3 justify-center items-center p-8 h-full text-center">
            <h2 className="text-xl">{t("allAnswered")}</h2>
            <p className="text-sm text-gray-600">{t("allAnsweredDetail")}</p>
            <Button
              label={t("done")}
              variant="outline-primary"
              width="fit"
              size="medium"
              onClick={handleClose}
            />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <Question
              // Keyed by the row, so each question is asked afresh.
              key={current}
              id={current}
              position={position}
              total={queue.length}
              onKeep={() => answer(() => acceptResemblance(store, current))}
              onDiscard={() => answer(() => setDiscarded(store, [current]))}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PublicationResemblances;
export type { Props as PublicationResemblancesProps };
