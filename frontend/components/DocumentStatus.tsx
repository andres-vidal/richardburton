"use client";

import CheckIcon from "assets/check.svg";
import ErrorCircleIcon from "assets/error-circle.svg";
import SpinnerIcon from "assets/spinner.svg";
import {
  useDocumentHealth,
  type DocumentHealth,
} from "modules/publication/presence";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Tooltip from "./Tooltip";

/**
 * The one state `DocumentStatus` shows for a shared document.
 *
 * It combines two conditions that can fail separately. `unsaved` means changes
 * made here have not reached the server, so work could be lost. `disconnected`
 * means the live connection is down and other people's changes are not
 * arriving. A document in that state looks the same as one nobody else is
 * editing, so this state is shown as well. `connecting`, `saving` and `saved`
 * are the normal states.
 *
 * The two conditions are shown as one state instead of two indicators, so a
 * reader can tell at a glance whether anything is wrong.
 */
type Health = "unsaved" | "disconnected" | "connecting" | "saving" | "saved";

/**
 * Returns the `Health` for a document's connection and save state. When more
 * than one applies, the first in this order wins: `unsaved`, `disconnected`,
 * `connecting`, `saving`, `saved`.
 */
function healthOf({ connection, saving }: DocumentHealth): Health {
  if (saving === "offline") return "unsaved";
  if (connection === "offline") return "disconnected";
  if (connection === "connecting") return "connecting";
  if (saving === "saving") return "saving";

  return "saved";
}

/**
 * The icon shown next to each state's label, and the variant of its tooltip.
 * `connecting` and `saving` are in progress, so they show a spinner. The icon's
 * `group-data-[health=…]:animate-spin` classes make it spin in those two states.
 */
const LOOK = {
  unsaved: { Icon: ErrorCircleIcon, variant: "error" },
  disconnected: { Icon: ErrorCircleIcon, variant: "error" },
  connecting: { Icon: SpinnerIcon, variant: "info" },
  saving: { Icon: SpinnerIcon, variant: "info" },
  saved: { Icon: CheckIcon, variant: "info" },
} as const satisfies Record<Health, { Icon: unknown; variant: string }>;

/**
 * Shows whether changes made here have been saved to the server, and whether
 * other people's changes are arriving. Hovering it shows a tooltip that
 * explains the state.
 *
 * Renders nothing outside a `LiveProvider`, because there is no shared document
 * to report on.
 */
const DocumentStatus: FC = () => {
  const t = useTranslations("documentStatus");
  const standing = useDocumentHealth();
  const health = standing === null ? null : healthOf(standing);
  const Icon = health === null ? null : LOOK[health].Icon;

  return health === null || Icon === null ? null : (
    <Tooltip variant={LOOK[health].variant} message={t(`${health}Detail`)}>
      <span
        role="status"
        data-health={health}
        aria-label={t(health)}
        className={`
          group flex gap-1.5 items-center py-1.5 px-2 text-xs rounded border whitespace-nowrap
          data-[health=saved]:text-green-800 data-[health=saved]:bg-green-50 data-[health=saved]:border-green-200
          data-[health=saving]:text-gray-700 data-[health=saving]:bg-gray-50 data-[health=saving]:border-gray-200
          data-[health=connecting]:text-gray-700 data-[health=connecting]:bg-gray-50 data-[health=connecting]:border-gray-200
          data-[health=disconnected]:text-amber-900 data-[health=disconnected]:bg-amber-50 data-[health=disconnected]:border-amber-300
          data-[health=unsaved]:text-red-800 data-[health=unsaved]:bg-red-50 data-[health=unsaved]:border-red-300
        `}
      >
        <Icon className="size-3.5 group-data-[health=saving]:animate-spin group-data-[health=connecting]:animate-spin" />
        {t(health)}
      </span>
    </Tooltip>
  );
};

export default DocumentStatus;
