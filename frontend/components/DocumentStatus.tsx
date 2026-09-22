"use client";

import CheckIcon from "assets/check.svg";
import DotIcon from "assets/dot.svg";
import ErrorCircleIcon from "assets/error-circle.svg";
import { useDocumentHealth } from "modules/publication/presence";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Tooltip from "./Tooltip";

/**
 * What this reader needs to know about a shared document, in one word.
 *
 * Two things can go wrong independently, and only one of them is about losing
 * work. `unsaved` means what was typed here has not reached the server, which
 * is the one worth interrupting for. `disconnected` means other people's
 * changes are not arriving, which is worth saying because a document that is
 * quietly not live looks exactly like one nobody else is editing.
 *
 * They are reported as one token rather than two indicators, because a reader
 * glancing at a toolbar has one question — is this all right? — and two lights
 * make them work out the answer.
 */
type Health =
  "unsaved" | "disconnected" | "connecting" | "saving" | "saved" | "alone";

/**
 * Where a shared document stands: whether what was typed here has been saved,
 * and whether anyone else's changes are arriving.
 *
 * Silent on a surface that is not a document, since an edit modal over the
 * database has nothing to be connected to.
 */
const DocumentStatus: FC = () => {
  const t = useTranslations("documentStatus");
  const { connection, saving } = useDocumentHealth();

  const health: Health =
    saving?.state === "offline"
      ? "unsaved"
      : connection === "offline"
        ? "disconnected"
        : connection === "connecting"
          ? "connecting"
          : saving?.state === "saving"
            ? "saving"
            : connection === "live"
              ? "saved"
              : "alone";

  const Icon =
    health === "unsaved" || health === "disconnected"
      ? ErrorCircleIcon
      : health === "saved"
        ? CheckIcon
        : DotIcon;

  return health === "alone" ? null : (
    <Tooltip
      variant={
        health === "unsaved" || health === "disconnected" ? "error" : "info"
      }
      message={t(`${health}Detail`)}
    >
      <span
        role="status"
        data-health={health}
        aria-label={t(health)}
        className={`
          flex gap-1.5 items-center py-1.5 px-2 text-xs rounded border whitespace-nowrap
          data-[health=saved]:text-green-800 data-[health=saved]:bg-green-50 data-[health=saved]:border-green-200
          data-[health=saving]:text-gray-700 data-[health=saving]:bg-gray-50 data-[health=saving]:border-gray-200
          data-[health=connecting]:text-gray-700 data-[health=connecting]:bg-gray-50 data-[health=connecting]:border-gray-200
          data-[health=disconnected]:text-amber-900 data-[health=disconnected]:bg-amber-50 data-[health=disconnected]:border-amber-300
          data-[health=unsaved]:text-red-800 data-[health=unsaved]:bg-red-50 data-[health=unsaved]:border-red-300
        `}
      >
        <Icon
          className={`
            size-3.5
            group-data-[health=saving]:animate-pulse
          `}
        />
        {t(health)}
      </span>
    </Tooltip>
  );
};

export default DocumentStatus;
export type { Health };
