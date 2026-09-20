"use client";

import RestoreTrashIcon from "assets/restore-trash.svg";
import {
  Publication,
  type DeletedPublicationEntry,
  type PublicationId,
} from "modules/publication/model";
import { useFormatDate } from "modules/dates";
import { restore } from "modules/publication/remote";
import { useRouter } from "i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";

/**
 * The trash: soft-deleted publications, most recently deleted first, each
 * restorable with one click — restoring is not destructive, so no confirmation
 * stands in the way. Restoring fails gracefully when the same record has been
 * imported again in the meantime (the server answers with a conflict).
 *
 * A successful restore asks the server to render the list again rather than
 * editing it here.
 */
const DeletedPublications: FC<{
  entries: DeletedPublicationEntry[];
  onRestore?: (id: PublicationId) => Promise<boolean>;
}> = ({ entries, onRestore = restore }) => {
  const t = useTranslations("admin");
  const locale = useLocale();
  const formatDate = useFormatDate();
  const [restoringId, setRestoringId] = useState<PublicationId>();
  const router = useRouter();

  async function handleRestore(id: PublicationId) {
    setRestoringId(id);
    try {
      if (await onRestore(id)) router.refresh();
    } finally {
      setRestoringId(undefined);
    }
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
                    authors: Publication.markedValue(
                      publication,
                      "authors",
                      locale,
                    ),
                    year: publication.year,
                    publishers: Publication.markedValue(
                      publication,
                      "publishers",
                      locale,
                    ),
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
                onClick={() => handleRestore(publication.id!)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DeletedPublications;
