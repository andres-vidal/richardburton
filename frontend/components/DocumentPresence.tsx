"use client";

import {
  colourOf,
  initial,
  useOthersPresent,
} from "modules/publication/presence";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Tooltip from "./Tooltip";

/**
 * Shows the other people who have this document open, each as their initial in
 * their presence colour. Renders nothing when nobody else has it open.
 *
 * Anyone who may edit publications can open any document, so this list shows
 * who has the document open now, not who is allowed to. The list comes from
 * Phoenix Presence on the document channel. The server tracks each connection under the email of its
 * signed-in user, so a client cannot choose the name it is listed under. A
 * person leaves the list when their tab closes, and the list is not stored.
 */
const DocumentPresence: FC = () => {
  const t = useTranslations("documents");
  const people = useOthersPresent();

  return people.length === 0 ? null : (
    <ul aria-label={t("hereNow")} className="flex items-center -space-x-1.5">
      {people.map((email) => (
        <li key={email}>
          <Tooltip variant="info" message={t("alsoHere", { who: email })}>
            <span
              aria-label={email}
              data-colour={colourOf(email)}
              className="
                flex justify-center items-center text-xs font-medium text-white
                rounded-full ring-2 ring-white size-6 bg-(--presence)
              "
            >
              {initial(email)}
            </span>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
};

export default DocumentPresence;
