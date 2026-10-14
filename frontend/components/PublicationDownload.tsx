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
import { FC, useRef } from "react";
import { useTranslations } from "next-intl";
import Button from "./Button";
import { useNotify } from "./Notifications";

const CONTENT_DISPOSITION = "content-disposition";

/** What the file is called when the server does not say. */
const FALLBACK_FILENAME = "publications.csv";

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

const PublicationDownload: FC = () => {
  const t = useTranslations("download");
  const notify = useNotify();
  const visibleCount = usePublicationCount();
  const visibleAttributes = useVisibleAttributes();
  const areAllAttributesVisible =
    visibleAttributes.length === Publication.ATTRIBUTES.length;

  const searchParams = useSearchParams();

  const anchor = useRef<HTMLAnchorElement>(null);

  const search = searchParams?.get("search") ?? undefined;

  const select = areAllAttributesVisible
    ? undefined
    : visibleAttributes.map(snakeCase);

  const download = async () => {
    try {
      await request(async (http) => {
        if (!anchor.current) return;

        const { data, headers } = await http.get("files/publications", {
          params: { search, select },
          responseType: "blob",
        });

        anchor.current.href = URL.createObjectURL(data);
        anchor.current.download = filenameFrom(headers[CONTENT_DISPOSITION]);
        anchor.current.click();
      });
    } catch {
      notify({
        message: "notify.downloadFailed",
        detail: "notify.downloadFailedDetail",
        level: "warning",
      });
    }
  };

  return (
    <>
      <Button
        label={t("csv")}
        variant="outline"
        alignment="left"
        Icon={DownloadIcon}
        disabled={visibleCount === 0}
        onClick={download}
        width="fixed"
      />
      <a className="hidden" ref={anchor} />
    </>
  );
};

export default PublicationDownload;
export { FALLBACK_FILENAME, filenameFrom };
