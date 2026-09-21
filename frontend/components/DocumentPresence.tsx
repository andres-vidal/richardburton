"use client";

import { useOthersPresent } from "modules/publication/presence";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Tooltip from "./Tooltip";

/** The first letter of an address, which is enough to tell two people apart. */
const initial = (email: string) => email.slice(0, 1).toUpperCase();

/**
 * Who else has this document open right now.
 *
 * The list of documents is shared, so this is not about who is allowed in — it
 * is about who is here. It comes from awareness over the live connection, is
 * true only while someone is looking, and is never written down: a person who
 * closes the tab is simply no longer in it.
 */
const DocumentPresence: FC = () => {
  const t = useTranslations("documents");
  const present = useOthersPresent();

  return present.length === 0 ? null : (
    <ul aria-label={t("hereNow")} className="flex items-center -space-x-1.5">
      {present.map((person) => (
        <li key={person.clientId}>
          <Tooltip
            variant="info"
            message={t("alsoHere", { who: person.email })}
          >
            <span
              aria-label={person.email}
              className="flex justify-center items-center text-xs font-medium text-white rounded-full ring-2 ring-white size-6 bg-indigo-500"
            >
              {initial(person.email)}
            </span>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
};

export default DocumentPresence;
