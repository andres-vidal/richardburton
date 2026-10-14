"use client";

import { request } from "app";
import DownloadIcon from "assets/download.svg";
import { snakeCase } from "lodash";
import { Publication } from "modules/publication/model";
import {
  useVisibleAttributes,
  usePublicationCount,
} from "modules/publication/hooks";
import { useSearchParams } from "next/navigation";
import { FC } from "react";
import { useTranslations } from "next-intl";
import Button from "./Button";
import { notify } from "./Notifications";

const CONTENT_DISPOSITION = "content-disposition";

/** What the file is called when the server does not say. */
const FALLBACK_FILENAME = "publications.csv";

/**
 * How long a downloaded file is kept in memory after its link is clicked, in
 * ms. Some browsers read the file after the click returns, so it is released
 * later rather than at once.
 */
const RELEASE_AFTER_MS = 60_000;

/**
 * Returns the filename in a `Content-Disposition` header, or
 * `FALLBACK_FILENAME` when the header is missing or cannot be parsed.
 *
 * It never throws, because the file has already been downloaded when the
 * header is read, and an unreadable header should not stop it being saved.
 */
function filenameFrom(disposition: unknown): string {
  const filename =
    typeof disposition === "string"
      ? /filename[^;=\n]*=([^;\n]*)/.exec(disposition)?.[1]
      : undefined;

  return filename?.replace(/"/g, "").trim() || FALLBACK_FILENAME;
}

/**
 * A button that downloads the publications of the current search as a CSV
 * file. The file has the columns that are shown, or every column when none is
 * hidden. It is saved under the name the server gives it, and the button is
 * disabled while there are no publications. A failed download raises a
 * notification.
 */
const PublicationDownload: FC = () => {
  const t = useTranslations("download");
  const visibleCount = usePublicationCount();
  const visibleAttributes = useVisibleAttributes();
  const areAllAttributesVisible =
    visibleAttributes.length === Publication.ATTRIBUTES.length;

  const searchParams = useSearchParams();

  const search = searchParams?.get("search") ?? undefined;

  const select = areAllAttributesVisible
    ? undefined
    : visibleAttributes.map(snakeCase);

  // Saves the file through a link that is clicked once and not attached to the
  // page, and releases the file `RELEASE_AFTER_MS` later.
  const download = async () => {
    try {
      const { data, headers } = await request((http) =>
        http.get("files/publications", {
          params: { search, select },
          responseType: "blob",
        }),
      );

      const link = document.createElement("a");
      link.href = URL.createObjectURL(data);
      link.download = filenameFrom(headers[CONTENT_DISPOSITION]);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), RELEASE_AFTER_MS);
    } catch {
      notify({
        message: "notify.downloadFailed",
        detail: "notify.downloadFailedDetail",
        level: "warning",
      });
    }
  };

  return (
    <Button
      label={t("csv")}
      variant="outline"
      alignment="left"
      Icon={DownloadIcon}
      disabled={visibleCount === 0}
      onClick={download}
      width="fixed"
    />
  );
};

export default PublicationDownload;
export { FALLBACK_FILENAME, filenameFrom };
