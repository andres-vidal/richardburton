"use client";

import { request } from "app";
import DownloadIcon from "assets/download.svg";
import { snakeCase } from "lodash";
import { Publication } from "modules/publication/model";
import {
  useVisibleAttributes,
  useVisiblePublicationCount,
} from "modules/publication/hooks";
import { useSearchParams } from "next/navigation";
import { FC, useRef } from "react";
import Button from "./Button";
import { useNotify } from "./Notifications";

const CONTENT_DISPOSITION = "content-disposition";

/** What the file is called when the server does not say. */
const FALLBACK_FILENAME = "publications.csv";

/**
 * The name the server gave the file, or a sensible one.
 *
 * A header that is missing or unparseable is not a failed download — the bytes
 * are already here — so it must not throw. It used to: the match was asserted
 * non-null, so a header this could not read took the whole download down with
 * it, before the click that saves the file.
 */
function filenameFrom(disposition: unknown): string {
  const filename =
    typeof disposition === "string"
      ? /filename[^;=\n]*=([^;\n]*)/.exec(disposition)?.[1]
      : undefined;

  return filename?.replace(/"/g, "").trim() || FALLBACK_FILENAME;
}

const PublicationDownload: FC = () => {
  const notify = useNotify();
  const visibleCount = useVisiblePublicationCount();
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
        message: "Could not download the .csv",
        detail: "Nothing was saved. Check your connection and try again.",
        level: "warning",
      });
    }
  };

  return (
    <>
      <Button
        label="Download .csv"
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
