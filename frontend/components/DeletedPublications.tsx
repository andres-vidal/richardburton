"use client";

import RestoreTrashIcon from "assets/restore-trash.svg";
import type {
  DeletedPublicationEntry,
  PublicationId,
} from "modules/publication/model";
import { FC, useState } from "react";
import Button from "./Button";

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * The trash: soft-deleted publications, most recently deleted first, each
 * restorable with one click — restoring is not destructive, so no confirmation
 * stands in the way. Restoring fails gracefully when the same record has been
 * imported again in the meantime (the server answers with a conflict).
 */
const DeletedPublications: FC<{
  entries: DeletedPublicationEntry[];
  /** Restores the record; resolve when the list is settled. */
  onRestore: (id: PublicationId) => Promise<void>;
}> = ({ entries, onRestore }) => {
  const [restoringId, setRestoringId] = useState<PublicationId>();

  async function handleRestore(id: PublicationId) {
    setRestoringId(id);
    try {
      await onRestore(id);
    } finally {
      setRestoringId(undefined);
    }
  }

  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-600">
          Nothing here — no publication is currently deleted.
        </p>
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
                  {publication.authors} · {publication.year} ·{" "}
                  {publication.publishers}
                </span>
                <span className="text-xs text-gray-500">
                  Deleted {formatTimestamp(deletedAt)}
                </span>
              </div>
              <Button
                label="Restore"
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
