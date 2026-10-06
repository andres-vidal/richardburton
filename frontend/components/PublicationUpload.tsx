"use client";

import UploadIcon from "assets/upload.svg";
import { usePublicationStore } from "modules/publication/workspace";
import { upload } from "modules/publication/remote";
import { useTranslations } from "next-intl";
import { ChangeEvent, FC, useRef, useState } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

/**
 * Adds the rows of a CSV file after the rows already in the workspace.
 *
 * The button opens a hidden file input. The rows of the chosen file are
 * validated by the server and appended to the import document as one edit of
 * this person, so their Undo takes the whole upload out again. Rows already in
 * the document, including other people's, are kept.
 */
const PublicationUpload: FC = () => {
  const t = useTranslations("admin");
  const store = usePublicationStore();

  const [key, setKey] = useState(1);
  const input = useRef<HTMLInputElement>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const [file] = event.target.files;
      const payload = new FormData();
      payload.append("csv", file);

      try {
        await upload(store, payload);
      } finally {
        // Reset the input, so the same file can be chosen again: after a
        // failed upload to retry it, or after an undo to add it once more.
        setKey((key) => -key);
      }
    }
  };

  return (
    <>
      <Tooltip variant="info" message={t("uploadHint")} placement="top">
        <Button
          label={t("upload")}
          variant="outline"
          Icon={UploadIcon}
          alignment="left"
          width="fixed"
          onClick={() => input.current?.click()}
        />
      </Tooltip>
      <input
        ref={input}
        key={key}
        type="file"
        id="upload-csv"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
};

export default PublicationUpload;
