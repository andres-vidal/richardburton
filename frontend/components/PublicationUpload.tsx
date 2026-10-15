"use client";

import UploadIcon from "assets/upload.svg";
import { usePublicationStore } from "modules/publication/workspace";
import { upload } from "modules/publication/remote";
import { useTranslations } from "next-intl";
import { ChangeEvent, FC, useRef } from "react";
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

  const input = useRef<HTMLInputElement>(null);

  // Uploads the chosen file, then empties the input, so the same file can be
  // chosen again: after a failed upload to retry it, or after an undo to add it
  // once more. `upload` notifies a failure itself, so a failure is not handled
  // again here.
  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.currentTarget;
    const file = chosen.files?.[0];
    if (!file) return;

    const payload = new FormData();
    payload.append("csv", file);

    await upload(store, payload).catch(() => {});
    chosen.value = "";
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
        type="file"
        id="upload-csv"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
};

export default PublicationUpload;
