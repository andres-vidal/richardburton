"use client";

import CheckIcon from "assets/check.svg";
import DotIcon from "assets/dot.svg";
import ErrorCircleIcon from "assets/error-circle.svg";
import {
  useDocumentHealth,
  type DocumentHealth,
} from "modules/publication/presence";
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
 * They are reported as one word rather than two indicators, because a reader
 * glancing at a toolbar has one question — is this all right? — and two lights
 * make them work out the answer.
 */
type Health = "unsaved" | "disconnected" | "connecting" | "saving" | "saved";

/**
 * The one word for how a document stands. Losing work outranks not hearing
 * from others, and both outrank the ordinary states.
 */
function healthOf({ connection, saving }: DocumentHealth): Health {
  if (saving === "offline") return "unsaved";
  if (connection === "offline") return "disconnected";
  if (connection === "connecting") return "connecting";
  if (saving === "saving") return "saving";

  return "saved";
}

/** How each word is drawn: the icon beside it, and the tooltip that explains it. */
const LOOK = {
  unsaved: { Icon: ErrorCircleIcon, variant: "error" },
  disconnected: { Icon: ErrorCircleIcon, variant: "error" },
  connecting: { Icon: DotIcon, variant: "info" },
  saving: { Icon: DotIcon, variant: "info" },
  saved: { Icon: CheckIcon, variant: "info" },
} as const satisfies Record<Health, { Icon: unknown; variant: string }>;

/**
 * Where a shared document stands: whether what was typed here has been saved,
 * and whether anyone else's changes are arriving.
 *
 * Silent on a surface that is not a document, since an edit modal over the
 * database has nothing to be connected to.
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
          flex gap-1.5 items-center py-1.5 px-2 text-xs rounded border whitespace-nowrap
          data-[health=saved]:text-green-800 data-[health=saved]:bg-green-50 data-[health=saved]:border-green-200
          data-[health=saving]:text-gray-700 data-[health=saving]:bg-gray-50 data-[health=saving]:border-gray-200
          data-[health=connecting]:text-gray-700 data-[health=connecting]:bg-gray-50 data-[health=connecting]:border-gray-200
          data-[health=disconnected]:text-amber-900 data-[health=disconnected]:bg-amber-50 data-[health=disconnected]:border-amber-300
          data-[health=unsaved]:text-red-800 data-[health=unsaved]:bg-red-50 data-[health=unsaved]:border-red-300
        `}
      >
        <Icon className="size-3.5" />
        {t(health)}
      </span>
    </Tooltip>
  );
};

export default DocumentStatus;
