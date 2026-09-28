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
 * Who else has this document open right now.
 *
 * The list of documents is shared, so this is not about who is allowed in — it
 * is about who is here. The server keeps it, per connection and under the
 * address it holds for each person, so nobody is shown on their own say-so. It
 * is true only while someone is looking, and is never written down: a person
 * who closes the tab is simply no longer in it.
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
