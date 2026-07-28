"use client";

import RestoreTrashIcon from "assets/restore-trash.svg";
import type {
  DeletedPublicationEntry,
  PublicationId,
} from "modules/publication/model";
import { restore } from "modules/publication/remote";
import { useRouter } from "next/navigation";
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
 *
 * A successful restore asks the server to render the list again rather than
 * editing it here.
 */
const DeletedPublications: FC<{
  entries: DeletedPublicationEntry[];
  onRestore?: (id: PublicationId) => Promise<boolean>;
}> = ({ entries, onRestore = restore }) => {
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
