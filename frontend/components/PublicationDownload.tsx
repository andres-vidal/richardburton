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
import qs from "qs";
import { FC, useRef } from "react";
import Button from "./Button";

const PublicationDownload: FC = () => {
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

  const download = () => {
    request(async (http) => {
      if (anchor.current) {
        const query = qs.stringify(
          { search, select },
          { encode: false, arrayFormat: "brackets" },
        );

        const { data, headers } = await http.get(
          `files/publications?${query}`,
          { responseType: "blob" },
        );

        const filename = /filename[^;=\n]*=([^;\n]*)/
          .exec(headers.contentDisposition)![1]
          .replace(/"/g, "");

        anchor.current.href = URL.createObjectURL(data);
        anchor.current.download = filename;
        anchor.current.click();
      }
    });
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
